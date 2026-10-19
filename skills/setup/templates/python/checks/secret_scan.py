"""Block staged secrets. `--all` audits every tracked working-tree file instead.

Tests are scanned too: build fixtures at runtime (`"AKIA" + "..."`) or keep them obviously
fake (short, or one repeated character). A reviewed line may carry `# pragma: allowlist secret`.
Add project-specific shapes under "extraPatterns" in scripts/checks/config.json.
"""

from __future__ import annotations

import re
import sys
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from pathlib import Path

from scripts.checks import config, git

PRAGMA = "pragma: allowlist secret"
LOCAL_HOSTS = {"localhost", "127.0.0.1", "[::1]", "db", "postgres", "redis", "mysql", "mongo"}
PLACEHOLDERS = {"password", "pass", "secret", "changeme", "example"}


def _varied(value: str) -> bool:
    """Real keys use many distinct characters; fixtures like "k" * 32 do not."""
    return len(set(value)) >= 8


def _credential(value: str) -> bool:
    """Assigned values must also mix letters and digits, so env-var names don't match."""
    return _varied(value) and any(c.isdigit() for c in value) and any(c.isalpha() for c in value)


def _real_database_url(match: re.Match) -> bool:
    password, host = match.group(1), match.group(2).lower()
    placeholder = any(c in password for c in "$<{*%") or password.lower() in PLACEHOLDERS
    return host not in LOCAL_HOSTS and not placeholder


def _group_varied(match: re.Match) -> bool:
    return match.lastindex is None or _varied(match.group(1))


@dataclass(frozen=True)
class Pattern:
    name: str
    regex: re.Pattern
    real: Callable[[re.Match], bool] = _group_varied


ASSIGNED = r"""(?i:\b\w*(?:secret|token|password|passwd|api_?key)\w*)["']?\s*[=:]\s*["']([^"'\s]{16,})["']"""

DEFAULT_PATTERNS = (
    Pattern("OpenRouter API key", re.compile(r"sk-or-(?:v1-)?[A-Za-z0-9]{32,}")),
    Pattern("Anthropic API key", re.compile(r"sk-ant-[\w-]{20,}")),
    Pattern("OpenAI API key", re.compile(r"sk-(?!or-|ant-)(?:proj-)?[A-Za-z0-9_-]{40,}")),
    Pattern("AWS access key", re.compile(r"AKIA[0-9A-Z]{16}")),
    Pattern("GitHub token", re.compile(r"gh[pousr]_[A-Za-z0-9]{30,}|github_pat_\w{30,}")),
    Pattern("Slack token", re.compile(r"xox[abprs]-[\w-]{20,}")),
    Pattern("Google API key", re.compile(r"AIza[\w-]{35}")),
    Pattern("Stripe live key", re.compile(r"[sr]k_live_[A-Za-z0-9]{20,}")),
    Pattern("Private key block", re.compile(r"-----BEGIN\s[\w\s]*?PRIVATE\sKEY-----")),
    Pattern("JWT", re.compile(r"eyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]{10,}")),
    Pattern("Database URL with password",
            re.compile(r"(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis)://[^:/\s@]+:([^@\s]+)@([^/:\s]+)"),
            _real_database_url),
    Pattern("Credential assignment", re.compile(ASSIGNED), lambda m: _credential(m.group(1))),
)


@dataclass(frozen=True)
class Finding:
    """Location and pattern name only, so hook output never re-leaks the value."""

    file: str
    line: int
    pattern: str


def build_patterns(extra: Iterable[dict]) -> tuple:
    return DEFAULT_PATTERNS + tuple(Pattern(spec["name"], re.compile(spec["regex"])) for spec in extra)


def is_skipped(path: str, skip: Iterable[str]) -> bool:
    return any(re.search(rule, path) for rule in skip)


def scan_content(content: str, path: str, patterns: tuple = DEFAULT_PATTERNS) -> list[Finding]:
    findings = []
    for number, text in enumerate(content.splitlines(), start=1):
        if PRAGMA in text:
            continue
        for pattern in patterns:
            if any(pattern.real(m) for m in pattern.regex.finditer(text)):
                findings.append(Finding(path, number, pattern.name))
    return findings


def scan_files(paths: Iterable[str], read: Callable[[str], str | None], skip: Iterable[str] = (),
               patterns: tuple = DEFAULT_PATTERNS) -> list[Finding]:
    skip = list(skip)
    findings = []
    for path in paths:
        content = None if is_skipped(path, skip) else read(path)
        if content is not None:
            findings.extend(scan_content(content, path, patterns))
    return findings


def _read_working(path: str) -> str | None:
    try:
        content = Path(path).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None
    return None if "\0" in content else content


def main(argv: list[str]) -> int:
    cfg = config.load()
    patterns = build_patterns(cfg["extraPatterns"])
    if "--all" in argv:
        findings = scan_files(git.tracked_files(), _read_working, cfg["secretSkip"], patterns)
    else:
        findings = scan_files(git.staged_files("ACM"), git.read_staged, cfg["secretSkip"], patterns)
    if not findings:
        return 0
    print("\nBLOCKED: possible secrets found:", file=sys.stderr)
    for f in findings:
        print(f"  {f.file}:{f.line}  {f.pattern}", file=sys.stderr)
    print("\nRead real values from the environment; build test fixtures at runtime.\n", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
