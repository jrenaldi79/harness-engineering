---
globs: ["src/**", "lib/**"]
---
# MANDATORY: Test-Driven Development (TDD) First

**EVERY feature request MUST start with writing tests before any implementation.**
**EVERY bug fix MUST start by reproducing the bug in a failing test.**

When receiving ANY feature request, your FIRST response should be:
1. "Following TDD - I'll write tests first to define what success looks like"
2. Write comprehensive failing tests using the Red-Green-Refactor cycle
3. Only then proceed with implementation to make tests pass

When receiving ANY bug report, your FIRST response should be:
1. "Reproducing the bug first - writing a test that triggers the exact error"
2. Write a test that demonstrates the reported failure
3. Run it and confirm it FAILS (proves you captured the bug)
4. Only then write the fix

## TDD Process - ALWAYS FOLLOW

1. **Red Phase** (REQUIRED FIRST STEP):
   - Write failing tests for the functionality you want to implement
   - Run tests to confirm they fail (shows "red" in test runner)
   - This validates that your test actually tests something

2. **Green Phase**:
   - Implement the simplest code that makes the test pass
   - Focus on making it work, not making it optimal
   - Run tests to confirm they now pass (shows "green")

3. **Refactor Phase**:
   - Clean up and optimize your implementation without changing behavior
   - Run tests after each refactor to ensure nothing is broken
   - Improve both implementation code AND test code

4. **Finalization Phase**:
   - Run full test suite
   - Validate test coverage >90% where applicable

5. **Documentation Check**:
   - If `src/`, `bin/`, or `scripts/` files were added/removed/renamed, run `node scripts/generate-docs.js` to auto-update CLAUDE.md (if available)
   - Run `node scripts/validate-docs.js --full` to verify no drift (if available)

## TDD Enforcement Checklist

**Before writing ANY implementation code, Claude MUST:**

1. **Explicitly state**: "Following TDD - writing tests first"
2. **Create test file** in appropriate `tests/` or `__tests__/` directory
3. **Write failing tests** that define expected behavior
4. **Run tests and show RED output** proving tests fail
5. **Only then write implementation**
6. **Run tests again and show GREEN output** proving tests pass

**Red Flags — STOP immediately if:**
- Creating files in `src/` before creating tests
- Using `Write` tool for implementation before tests exist
- Planning describes implementation details before test strategy
- User asks for feature and you immediately start coding
- Editing source/config files before a reproduction test exists for a bug fix
- Theorizing about root cause without confirming it with a failing test
- Merging a fix that was never verified against the actual error

## Bug Fix Workflow — Reproduce First

**EVERY bug fix MUST start by reproducing the bug in a test.**

1. **Reproduce** (REQUIRED FIRST STEP):
   - Write a test that triggers the exact error or behavior reported
   - Run the test and confirm it FAILS — this proves you've captured the bug
   - If you cannot reproduce it, investigate further before writing any fix

2. **Fix**:
   - Implement the minimal change that makes the reproduction test pass
   - Do NOT merge or commit the fix before the reproduction test exists

3. **Validate**:
   - Run the full test suite to check for regressions
   - Confirm the reproduction test passes with the fix applied

## TDD Self-Check Questions

Before writing implementation, ask yourself:
1. Have I written tests that will fail without this code?
2. Have I run those tests and confirmed they're RED?
3. Can I describe what "passing" looks like in concrete test assertions?

If the answer to ANY of these is "no", STOP and write tests first.

## When TDD Can Be Skipped

TDD may be relaxed ONLY for:
- Documentation-only changes (*.md files)
- Simple refactoring with existing test coverage

Bug fixes are NEVER exempt — always reproduce first, even for configuration file changes.

**All other code changes require tests first.**
