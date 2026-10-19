"""Line limit on staged code files. `--all` lists oversized tracked files, never fails.

"ratchet" (default): a new file may not exceed the limit and a file already over it may
shrink or hold but not grow, blocked when new > max(limit, committed). "cap": blocked
whenever new > limit. Both settings live in scripts/checks/config.json.
"""

from __future__ import annotations

import sys
from collections.abc import Callable, Iterable
from pathlib import Path, PurePosixPath

from scripts.checks import config, git


def is_checked(path: str, cfg: dict) -> bool:
    skipped = any(path.startswith(prefix) for prefix in cfg["sizeSkip"])
    return PurePosixPath(path).suffix in cfg["codeSuffixes"] and not skipped


def count_lines(content: str) -> int:
    return content.count("\n") + (0 if content == "" or content.endswith("\n") else 1)


def violations(paths: Iterable[str], read_new: Callable[[str], str | None],
               read_old: Callable[[str], str | None], cfg: dict) -> list[tuple[str, int, int | None]]:
    found = []
    for path in (p for p in paths if is_checked(p, cfg)):
        new = read_new(path)
        if new is None:
            continue
        old = read_old(path)
        new_lines, old_lines = count_lines(new), None if old is None else count_lines(old)
        allowed = cfg["limit"] if cfg["sizePolicy"] == "cap" else max(cfg["limit"], old_lines or 0)
        if new_lines > allowed:
            found.append((path, new_lines, old_lines))
    return found


def _report_all(cfg: dict) -> int:
    sizes = []
    for path in (p for p in git.tracked_files() if is_checked(p, cfg)):
        try:
            sizes.append((count_lines(Path(path).read_text(encoding="utf-8", errors="replace")), path))
        except OSError:
            continue
    for lines, path in sorted(sizes, reverse=True):
        if lines > cfg["limit"]:
            print(f"  {lines:5d}  {path}")
    return 0


def main(argv: list[str]) -> int:
    cfg = config.load()
    if "--all" in argv:
        return _report_all(cfg)
    found = violations(git.staged_files("ACMR"), git.read_staged, git.read_head, cfg)
    if not found:
        return 0
    print(f"\nBLOCKED: files over the {cfg['limit']}-line limit:", file=sys.stderr)
    for path, new, old in found:
        detail = "new file" if old is None else f"was {old}"
        print(f"  {path}: {new} lines ({detail})", file=sys.stderr)
    hint = "Files already over the limit may shrink but not grow." if cfg["sizePolicy"] == "ratchet" else ""
    print(f"\nSplit the module. {hint}\n", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
