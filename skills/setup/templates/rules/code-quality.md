---
globs: ["src/**", "lib/**", "scripts/**"]
---
# Code Quality Rules

## File Size Limits (HARD LIMITS)

| Entity | Max Lines | Action If Exceeded |
|--------|-----------|-------------------|
| **Any file** | 300 lines | MUST refactor immediately |
| **Any function** | 50 lines | MUST break into smaller functions |

The 300-line file limit is mechanically enforced by `check-file-sizes.js` in the pre-commit hook. The 50-line function limit is advisory but should be treated as equally important.

## Documentation Sync (HARD RULE)

Any commit that adds, removes, or renames a file in `src/`, `bin/`, or `scripts/` MUST include a CLAUDE.md update in the same commit. This is not optional. The pre-commit hook will warn if CLAUDE.md is not staged alongside tracked file changes.

## Complexity Red Flags

**STOP and refactor immediately if you see:**

- **>5 nested if/else statements** -> Extract to separate functions
- **>3 try/catch blocks in one function** -> Split error handling
- **>10 imports** -> Consider splitting the module
- **Duplicate logic** -> Extract to shared utilities

## Code Quality Monitoring

```bash
# Check line counts (monitor file sizes, target <300 lines)
find src -name "*.js" -exec wc -l {} + | sort -n

# Find large files (>300 lines need refactoring)
find src -name "*.js" -exec wc -l {} + | awk '$1 > 300'
```
