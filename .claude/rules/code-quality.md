---
globs: ["skills/setup/scripts/**", "tests/scripts/**"]
---
# Code Quality Rules

## File Size Limits (HARD LIMITS)

| Entity | Max Lines | Action If Exceeded |
|--------|-----------|-------------------|
| **Any file** | 300 lines | MUST refactor immediately |
| **Any function** | 50 lines | MUST break into smaller functions |

The 300-line file limit is mechanically enforced by `check-file-sizes.js` in the pre-commit hook. The 50-line function limit is advisory but should be treated as equally important.

## Complexity Red Flags

**STOP and refactor immediately if you see:**

- **>5 nested if/else statements** -> Extract to separate functions
- **>3 try/catch blocks in one function** -> Split error handling
- **>10 imports** -> Consider splitting the module
- **Duplicate logic** -> Extract to shared utilities

## Scripts Must Be Standalone

Enforcement scripts in `skills/setup/scripts/` are copied into user projects by `/setup`. They must:
- Use only Node.js built-ins (no npm dependencies)
- Work from any working directory
- Not reference paths inside this repo
