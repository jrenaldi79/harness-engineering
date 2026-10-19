---
globs: ['src/**', 'scripts/**', 'tests/**', '**/*.py']
---

# Code Quality Rules

## Size Limits

| Entity | Max Lines | Enforced By |
| --- | --- | --- |
| **Any code file** | 300 | `scripts/checks/file_sizes.py` (pre-commit) |
| **Any function** | 50 | Code review |

`sizePolicy` in `scripts/checks/config.json` decides how the file limit applies. Under `ratchet`, new
files are capped and files already over the limit may shrink or hold but never grow; adding to one means
extracting a sibling module first. Under `cap`, no staged file may exceed it. `--all` lists oversized files.
Generated or vendored paths belong in `sizeSkip`, never in a raised limit.

## Complexity Red Flags

**STOP and refactor if you see:**

- **>5 nested if/else statements** -> extract functions
- **>3 try/except blocks in one function** -> split error handling
- **>10 imports** -> consider splitting the module
- **Duplicate logic** -> extract a shared helper

## Secrets

Never commit credentials; read them from the environment. `scripts/checks/secret_scan.py` scans staged
files, **tests included**, for provider keys, JWTs, private keys, credential assignments and database URLs
with real passwords. Build fixtures at runtime (`"AKIA" + "..."`) or keep them obviously fake (`"k" * 32`).
Mark a reviewed false positive with `# pragma: allowlist secret`. Add project-specific key shapes to
`extraPatterns` in `scripts/checks/config.json` with a test case.

## Documentation Sync

Adding, removing or renaming source files, or adding a doc under `docs/`, means regenerating the index
(`node scripts/self-documentation/generate.js`) in the same commit. The pre-commit hook validates the
staged snapshot. When folder notes are on, a new source folder gets its `CLAUDE.md` note in the same commit.
