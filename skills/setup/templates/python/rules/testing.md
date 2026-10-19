---
globs: ['tests/**', '**/test_*.py', '**/*_test.py']
---

# Testing Patterns

- pytest, with test files named so `testMap` in `scripts/checks/config.json` finds them
  (default: `tests/**/test_<module>*.py`). Shared helpers and `conftest.py` are not tests.
- Run one file while iterating: `uv run pytest tests/test_x.py`; the pre-push hook runs the full suite.
- Use markers for slow or external suites (`live`, `db`) and deselect them by default in `pyproject.toml`
  (`addopts = "-m 'not live'"`), so the default run stays fast and offline.
- Inject dependencies (clients, stores, clocks) as parameters and pass fakes; prefer fakes over
  `unittest.mock.patch` on module globals. Stub HTTP with `respx`/`responses` rather than real network.
- Fixtures that look like secrets are built at runtime; the secret scan covers tests.

## Checklist

- [ ] Test written first and seen failing
- [ ] Error paths and limits covered, not just the happy path
- [ ] No inter-test dependencies, real network or wall-clock sleeps
