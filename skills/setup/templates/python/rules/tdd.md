---
globs: ['src/**', 'scripts/**', '**/*.py']
---

# MANDATORY: Test-Driven Development (TDD) First

**EVERY feature request MUST start with writing tests before any implementation.**
**EVERY bug fix MUST start by reproducing the bug in a failing test.**

When receiving ANY feature request, your FIRST response should be:

1. "Following TDD - I'll write tests first to define what success looks like"
2. Write failing tests using the Red-Green-Refactor cycle
3. Only then proceed with implementation to make tests pass

When receiving ANY bug report, your FIRST response should be:

1. "Reproducing the bug first - writing a test that triggers the exact error"
2. Write a test that demonstrates the reported failure
3. Run it and confirm it FAILS (proves you captured the bug)
4. Only then write the fix

## TDD Process - ALWAYS FOLLOW

1. **Red**: write the test where `testMap` in `scripts/checks/config.json` expects it, run it alone and
   see it fail: `uv run pytest tests/test_x.py` (or `pytest tests/test_x.py` without uv).
2. **Green**: the simplest code that makes it pass; re-run the single file.
3. **Refactor**: clean up implementation and test without changing behavior; re-run.
4. **Finalize**: `ruff check` and the full `pytest` run.
5. **Docs**: files added, removed or renamed -> `node scripts/self-documentation/generate.js`, review, stage.

## Enforcement

`scripts/checks/missing_tests.py` (pre-commit) blocks a commit that **adds** a module without a test
matching its `testMap` rule. `python -m scripts.checks.missing_tests --all` lists the existing backlog.

**Red Flags — STOP immediately if:**

- Creating modules before their tests
- Editing source/config files before a reproduction test exists for a bug fix
- Theorizing about root cause without confirming it with a failing test
- Merging a fix that was never verified against the actual error

## When TDD Can Be Skipped

Only for documentation-only changes and simple refactors with existing coverage. Bug fixes are NEVER exempt.
