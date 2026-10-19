# Python Stack Reference

Reference for Claude when setting up Python projects (uv or pip, ruff, pytest). Read this when Phase 1
finds a `pyproject.toml` or the user picks Python in Phase 2.

---

## Fast path: install-python.js

```bash
node $SCRIPTS_DIR/install-python.js --target=<project-root> [--size-policy=ratchet|cap] [--folder-notes] [--skip-install]
```

It requires a `pyproject.toml` and never overwrites an existing file. It installs:

| Target path | What |
| --- | --- |
| `scripts/checks/` | Stdlib-only gates: `secret_scan`, `missing_tests`, `file_sizes`, plus `git` and `config` helpers |
| `scripts/checks/config.json` | Line limit, size policy and the `testMap` for the detected layout |
| `tests/test_checks_*.py` | pytest suites for the gates, so the project owns and can extend them |
| `pyproject.toml` | Adds `pythonpath = ["."]` under `[tool.pytest.ini_options]` so tests can import `scripts.checks` |
| `.githooks/pre-commit`, `pre-push` | Gates, the staged docs check and `ruff check` on commit; `pytest` on push |
| `.claude/settings.json`, `.claude/rules/` | `Tool(specifier)` permissions; TDD, code-quality, testing and Python rules |
| `.gitignore` | Python patterns that are missing (`.venv/`, `__pycache__/`, caches, `.env`) |
| `scripts/self-documentation/` | The documentation engine over the source roots plus `scripts` |

Hooks run through `uv run --quiet` when the project has `uv.lock` or `[tool.uv]`, and call the tools
directly otherwise. The installer sets `core.hooksPath` to `.githooks`. If another manager already owns
it (for example `.husky`), the installer leaves it and prints how to call the hooks from there. Unless
`--skip-install` is given, uv projects get `uv add --dev pytest ruff`. Pip projects are told to add both.

Layout detection: a `src/` folder means `testMap` covers `src`. Otherwise each top-level folder with an
`__init__.py` is covered, apart from `tests`, `scripts`, `docs`, `build` and `dist`.

## Size policy

- **`ratchet`** (default; right for existing projects): a new file may not exceed the limit. A file
  already over it may shrink or hold steady but not grow. `python -m scripts.checks.file_sizes --all`
  lists the grandfathered files.
- **`cap`** (right for new projects): no staged file may exceed the limit.

Ask which one the user wants for an existing project with oversized files. Generated or vendored code
goes in `sizeSkip`; never raise `limit` to make it fit.

## Customizing scripts/checks/config.json

```json
{
  "limit": 300,
  "sizePolicy": "ratchet",
  "sizeSkip": ["src/app/generated/"],
  "secretSkip": ["(^|/)uv\\.lock$"],
  "extraPatterns": [{ "name": "Vault key", "regex": "v1:([A-Za-z0-9+/]{43}=)" }],
  "testMap": [
    { "dir": "src/app/hosted", "pattern": "tests/test_hosted_{stem}*.py" },
    { "dir": "src", "pattern": "tests/*test_{stem}*.py" }
  ]
}
```

- `testMap`: the first rule whose `dir` contains a newly added module supplies a glob that some test
  file must match. `*` also crosses folders, `{stem}` is the module name and `{parent}` its folder.
  List specific rules first. Dunder modules and paths outside every rule are exempt.
- `extraPatterns`: project-specific credential shapes. When the regex has a capture group, the match
  counts only if the group looks varied, so fixtures like `"A" * 43` pass. Add a test case for each one.
- `secretSkip` replaces the default list (lockfiles), so keep those entries when adding your own.
- Tests are scanned too. Fixtures are built at runtime, and a reviewed line may carry
  `# pragma: allowlist secret`.

## Suggested pyproject.toml settings

```toml
[dependency-groups]
dev = ["pytest", "ruff"]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
markers = ["live: hits real external services"]
addopts = "-m 'not live'"

[tool.ruff]
line-length = 120
```

## Generated assets and other languages

If the project commits build output, such as bundled HTML from a JavaScript `ui/` folder, add its
folder to `sizeSkip` and the `secretSkip` regexes. Then add a freshness gate: rebuild in CI and fail
when `git status --porcelain -- '<output>/*.html'` is non-empty. A `--porcelain` check also catches new
bundles that were never committed, which `git diff --exit-code` misses. `missing_tests` only checks `.py`
modules, so enforce JavaScript spec mapping (such as Playwright) through review or a project-specific check.

## CI

```yaml
- uses: astral-sh/setup-uv@v10.2.0
- run: uv sync
- run: uv run ruff check
- run: uv run pytest
- run: uv run python -m scripts.checks.secret_scan --all
- run: node scripts/self-documentation/generate.js --check
```
