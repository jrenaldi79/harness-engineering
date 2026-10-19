"""Thin git readers for the pre-commit gates. Only this module shells out."""

from __future__ import annotations

import subprocess


def _git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], check=True, capture_output=True, text=True, encoding="utf-8", errors="replace"
    ).stdout


def _lines(output: str) -> list[str]:
    return [line for line in output.splitlines() if line]


def staged_files(diff_filter: str) -> list[str]:
    """Staged paths, e.g. filter 'ACM' (added/copied/modified) or 'A' (added only)."""
    return _lines(_git("diff", "--cached", "--name-only", f"--diff-filter={diff_filter}"))


def tracked_files() -> list[str]:
    return _lines(_git("ls-files"))


def all_files() -> list[str]:
    """Tracked plus untracked, non-ignored files."""
    return _lines(_git("ls-files", "--cached", "--others", "--exclude-standard"))


def _show(spec: str) -> str | None:
    try:
        content = _git("show", spec)
    except subprocess.CalledProcessError:
        return None
    return None if "\0" in content else content


def read_staged(path: str) -> str | None:
    """The staged blob, so unstaged edits cannot hide what is actually being committed."""
    return _show(f":{path}")


def read_head(path: str) -> str | None:
    """The committed blob, or None for a new file (or a repository without commits)."""
    return _show(f"HEAD:{path}")
