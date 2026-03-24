---
globs: ["skills/setup/scripts/**", "tests/**"]
---
# MANDATORY: Test-Driven Development (TDD) First

**EVERY feature request MUST start with writing tests before any implementation.**

When receiving ANY feature request, your FIRST response should be:
1. "Following TDD - I'll write tests first to define what success looks like"
2. Write comprehensive failing tests using the Red-Green-Refactor cycle
3. Only then proceed with implementation to make tests pass

## TDD Process - ALWAYS FOLLOW

1. **Red Phase** (REQUIRED FIRST STEP):
   - Write failing tests for the functionality you want to implement
   - Run tests to confirm they fail (shows "red" in test runner)

2. **Green Phase**:
   - Implement the simplest code that makes the test pass
   - Run tests to confirm they now pass (shows "green")

3. **Refactor Phase**:
   - Clean up and optimize without changing behavior
   - Run tests after each refactor

## TDD Enforcement Checklist

**Before writing ANY implementation code, Claude MUST:**

1. **Explicitly state**: "Following TDD - writing tests first"
2. **Create test file** in `tests/scripts/`
3. **Write failing tests** that define expected behavior
4. **Run tests and show RED output** proving tests fail
5. **Only then write implementation**
6. **Run tests again and show GREEN output** proving tests pass

## When TDD Can Be Skipped

TDD may be relaxed ONLY for:
- Documentation-only changes (*.md files)
- Configuration files (settings.json, plugin.json)
- Simple refactoring with existing test coverage
