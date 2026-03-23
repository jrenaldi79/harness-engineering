---
globs: ["tests/**", "**/*.test.*", "**/*.spec.*"]
---
# Testing Patterns

## Test Types
- **Unit Tests**: Test critical functionality (business logic, utility functions)
- **Integration Tests**: Test full request/response cycles for APIs
- **Component Tests**: Test behavior with different props/state combinations

## Best Practices
- **Prefer single test runs** during development for performance: `npm test path/to/test.ts`
- Run unit tests after completing medium-sized tasks to catch bugs early
- Mock dependencies until they're built, then swap to real implementations
- Write maintainable tests with descriptive names grouped in describe blocks

## Code Review Checklist (for test files)
- [ ] Tests written first (TDD) and passing
- [ ] Descriptive test names that document expected behavior
- [ ] Edge cases and error paths covered
- [ ] No test interdependencies (each test is independent)
