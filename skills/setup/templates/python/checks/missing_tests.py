"""Block newly added modules that arrive without a test (TDD). `--all` lists every gap, never fails.

Rules come from "testMap" in scripts/checks/config.json: the first rule whose `dir`
contains the module supplies a glob (`*` also crosses folders) that some test file
must match. Dunder modules and paths outside every rule are exempt.
"""

from __future__ import annotations

import sys
from collections.abc import Iterable
from fnmatch import fnmatch
from pathlib import PurePosixPath

from scripts.checks import config, git


def expected_test(path: str, rules: Iterable[dict]) -> str | None:
    """Glob of acceptable tests for `path`, or None when it needs none."""
    p = PurePosixPath(path)
    if p.suffix != ".py" or p.name.startswith("__"):
        return None
    for rule in rules:
        if path.startswith(rule["dir"].rstrip("/") + "/"):
            return rule["pattern"].format(stem=p.stem, parent=p.parent.name)
    return None


def find_missing(added: Iterable[str], existing: Iterable[str], rules: Iterable[dict]) -> list[tuple[str, str]]:
    added, rules = list(added), list(rules)
    known = [*existing, *added]
    missing = []
    for path in added:
        pattern = expected_test(path, rules)
        if pattern and not any(fnmatch(candidate, pattern) for candidate in known):
            missing.append((path, pattern))
    return missing


def main(argv: list[str]) -> int:
    report = "--all" in argv
    added = git.tracked_files() if report else git.staged_files("A")
    missing = find_missing(added, git.all_files(), config.load()["testMap"])
    if not missing:
        return 0
    heading = "Modules without a mapped test:" if report else "BLOCKED: new modules need a test first (TDD):"
    print(f"\n{heading}", file=sys.stderr)
    for path, pattern in missing:
        print(f"  {path}  ->  {pattern}", file=sys.stderr)
    print(file=sys.stderr)
    return 0 if report else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
