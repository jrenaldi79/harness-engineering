# Unit Tests

Jest unit tests for the enforcement scripts, scaffolding tools, and documentation generators.

## Running

```bash
npx jest --config '{}' tests/scripts/              # All tests
npx jest --config '{}' tests/scripts/release.test.js  # Single file
```

## Test Files

| Test | What It Covers |
|---|---|
| `detect-source-dirs.test.js` | `detectSourceDirs` adaptive scanning and `buildModuleIndex` across multiple source dirs |
| `generate-docs.test.js` | `replaceMarkers`, `validateCrossLinks`, `buildDocsIndex`, `checkMarkersAreCurrent` |
| `generate-docs-helpers.test.js` | `buildDirectoryTree`, `extractJSDocDescription`, `extractExports` |
| `generate-claude-md.test.js` | CLAUDE.md generation from templates with framework-specific commands |
| `init-project.test.js` | Node/TS project scaffolding (directories, package.json, tsconfig) |
| `install-enforcement.test.js` | Enforcement script copying, hook installation, config generation |
| `marketplace-schema.test.js` | Plugin manifest validation (plugin.json, marketplace.json) |
| `release.test.js` | Release script: version validation, changelog check, version bump, tagging |
| `repo-generate-docs.test.js` | Repo-level CLAUDE.md auto-generation (tree + modules for this repo) |

## Conventions

- Each test gets a temp directory (`os.tmpdir`), cleaned up in `afterEach`
- Scripts run as child processes via `execFileSync` to isolate side effects
- Tests verify both file existence and file content
- Git operations in tests disable GPG signing (`commit.gpgsign false`)
