# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2026-03-25

### Fixed

- Level-5-autonomous fixture: added missing deps (express, @types/express, supertest), fixed TypeScript implicit any, added posttest caching script
- Readiness skill now checks both `.git/hooks/` and `.husky/` for hook-related criteria

## [1.2.0] - 2026-03-25

### Added

- 86 unit tests for enforcement scripts: check-file-sizes, check-secrets, check-test-colocation, validate-docs, and incremental doc indexing
- 23 E2E tests for post-setup lifecycle: enforcement round-trips against real git repos, doc indexing subprocess, git commit hook integration, doc drift detection
- Python/FastAPI adaptive path eval scenario (`setup-python`)
- Setup-then-readiness loop eval — verifies `/setup` output scores Level 3+ on `/readiness`
- Multi-step eval support in `run-evals.sh` (steps array in test case config)
- Hook-commit validation in setup grader: simulates real `git commit` after setup
- Deny list validation in setup grader: verifies `rm -rf`, `push --force`, `reset --hard` are blocked
- CLAUDE.md content checks in setup grader: `claude_md_must_mention` / `claude_md_must_not_mention`

### Fixed

- **Glob matching bug**: `**/` now matches zero or more directories. Previously `src/**/*.js` silently skipped files directly in `src/` — only matched files in subdirectories. Affected check-file-sizes, check-secrets, and check-test-colocation.
- **Pre-commit hook missing `set -e`**: enforcement script failures (e.g. secret detection exit 1) were silently ignored and commits went through anyway
- **Readiness report path**: moved from `.claude/readiness-report.md` to project root `readiness-report.md` — `.claude/` is write-protected in non-interactive modes
- **Eval permissions**: seed `.claude/settings.json` with tool permissions before git init, disable GPG signing for eval commits
- **Eval hook detection**: grader now checks both `.git/hooks/` and `.husky/` for hook existence and executability
- **Eval timeouts**: readiness 300→600s, setup 600→900s, setup-then-readiness 1200s

## [1.1.0] - 2026-03-24

### Added

- `/setup` skill verification phase (Phase 6): 6 smoke checks run after installation to confirm hooks, enforcement scripts, CLAUDE.md, agent config, auto-docs pipeline, and linter all work
- Setup eval suite: `setup-eval-config.json`, `setup-grader.js`, and 2 fixtures (`setup-bare`, `setup-existing-node`)
- `run-evals.sh` now accepts `--config` flag and per-test-case prompt overrides
- `scripts/repo-generate-docs.js`: auto-regenerates CLAUDE.md `AUTO:tree` and `AUTO:modules` markers on every commit via pre-commit hook
- OSS infrastructure: CI workflow, issue/PR templates, CODEOWNERS, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, CHANGELOG, .editorconfig

### Fixed

- `extractJSDocDescription` now tries multi-line JSDoc before single-line (was picking up `@param` annotations instead of file-level descriptions)
- Pre-push hook test cache: added missing `exit 0` after cache hit (was printing "skipping" but running anyway)
- Added `results` to `SKIP_DIRS` so eval output directories are excluded from generated trees
- Added `.env`, `coverage/`, `dist/`, `build/` to `.gitignore`

## [1.0.0] - 2026-03-24

### Added

- `/readiness` skill: evaluates codebases across 8 pillars and 5 maturity levels with scored reports
- `/setup` skill: scaffolds CLAUDE.md files, enforcement scripts, git hooks, linter configs, and agent settings
- Enforcement scripts: secret scanning, file size limits, test colocation, doc generation, drift detection
- Git hook templates: pre-commit (6 checks) and pre-push (test suite with SHA caching)
- CLAUDE.md templates: global (cross-project standards) and project (per-codebase guidance)
- Path-scoped rule templates: TDD, code quality, testing, TypeScript
- Config templates: ESLint, Prettier, lint-staged, .gitignore, .env.example, Claude Code settings
- Reference mapping of 20+ best practices from OpenAI, Anthropic, Augment Code, Factory.ai, and practitioners
- Evaluation suite with 3 fixture projects (level 1, 3, 5) and automated grading
- Unit tests for all setup scripts
- Plugin manifest for Claude Code marketplace
