---
globs: "src/**/*.ts"
---

# TDD Enforcement

## Mandatory Red-Green-Refactor Cycle

1. **RED**: Write a failing test first. Run it. See it fail.
2. **GREEN**: Write the minimum code to make the test pass.
3. **REFACTOR**: Clean up while keeping tests green.

## Rules

- Never write implementation code without a failing test
- Test files must be colocated: `foo.ts` → `foo.test.ts`
- Run `npm test` after every change
- Coverage must stay above 80% on all metrics
