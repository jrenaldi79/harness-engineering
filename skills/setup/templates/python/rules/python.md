---
globs: ['**/*.py', 'pyproject.toml']
---

# Python Conventions

- One `pyproject.toml` at the root. With uv: `uv sync`, `uv add <pkg>` (`--dev` for tooling) and commit
  `uv.lock`; never `pip install` into the project environment by hand.
- `ruff check` must pass (pre-commit). Keep ruff settings in `pyproject.toml` under `[tool.ruff]`.
- snake_case modules and functions, PascalCase classes, UPPER_CASE constants (PEP 8). Type-hint public functions.
- Validate external input (HTTP bodies, environment, files, model output) at the boundary; raise typed
  exceptions for conditions callers branch on and never swallow exceptions silently.
- Never log secrets or tokens; redact before logging or raising.
- `scripts/checks/` is stdlib only so the git hooks run before any dependency is importable.
