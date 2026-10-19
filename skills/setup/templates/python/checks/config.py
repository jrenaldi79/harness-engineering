"""Project settings for the checks: scripts/checks/config.json merged over these defaults."""

from __future__ import annotations

import json
from pathlib import Path

CONFIG_PATH = Path("scripts/checks/config.json")

DEFAULTS = {
    # 300-line limit. "ratchet": files already over it may shrink or hold, never grow. "cap": none may exceed it.
    "limit": 300,
    "sizePolicy": "ratchet",
    "codeSuffixes": [".py", ".pyi", ".sh", ".js", ".mjs", ".ts", ".html", ".css"],
    "sizeSkip": [],  # path prefixes: generated or vendored code
    "secretSkip": [r"(^|/)(uv|poetry|pdm|Pipfile)\.lock$", r"(^|/)package-lock\.json$"],  # regexes
    "extraPatterns": [],  # [{"name": "...", "regex": "..."}]; a capture group must look varied to count
    # First rule whose dir contains the module wins. {stem} = module name, {parent} = its folder name.
    "testMap": [{"dir": "src", "pattern": "tests/*test_{stem}*.py"}],
}


def load(path: Path = CONFIG_PATH) -> dict:
    if not path.is_file():
        return dict(DEFAULTS)
    return {**DEFAULTS, **json.loads(path.read_text(encoding="utf-8"))}
