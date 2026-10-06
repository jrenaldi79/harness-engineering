# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

**harness-engineering** is a Claude Code plugin and reference for AI coding agent harnesses. The full plugin provides `/readiness` and `/setup`; the independent documentation plugin provides `/documentation:documentation`. Together they assess and configure projects, with a README mapping 20+ best practices from industry sources.

### Core Features

- **`/readiness`**: Scores a codebase across 8 pillars and 5 maturity levels, produces a saved report with delta tracking
- **`/setup`**: Scaffolds CLAUDE.md files, enforcement scripts, git hooks, linter configs, and agent settings via Socratic questioning
- **Reference guide**: Maps best practices from OpenAI, Anthropic, Augment Code, Factory.ai, and practitioners to concrete implementation patterns

---

## Essential Commands

### Testing
```bash
node --test tests/documentation/engine.test.js tests/documentation/git-inventory.test.js tests/documentation/install.test.js tests/documentation/integration.test.js
node --experimental-vm-modules node_modules/.bin/jest tests/scripts/   # Unit tests for setup scripts
bash tests/evals/run-evals.sh                                          # E2E readiness evals (default)
bash tests/evals/run-evals.sh --config setup-eval-config.json          # E2E setup evals
bash tests/evals/test-marketplace-install.sh                           # Test plugin install flow
```

### Validation
```bash
node scripts/repo-generate-docs.js --check              # Verify indexes and compact markers
node scripts/repo-generate-docs.js --staged             # Validate the exact staged snapshot
```

### Setup
```bash
bash scripts/install-hooks.sh   # Install git hooks (pre-commit + pre-push)
```

---

## Architecture

<!-- AUTO:tree -->
[Source inventory](docs/index.md#source-inventory)
- skills: 27 files
- scripts: 6 files
- tests: 34 files
- plugins: 11 files
<!-- /AUTO:tree -->

### Data Flow

```
User installs plugin
  -> /readiness reads templates/references as benchmark
  -> 3 parallel subagents evaluate project against 8 pillars
  -> Scored report saved to readiness-report.md

User runs /setup
  -> Socratic questions determine stack and goals
  -> Scripts scaffold project structure, configs, hooks
  -> Enforcement scripts copied to target project's scripts/
  -> Git hooks wired to run enforcement on every commit/push
```

---

## Key Modules

<!-- AUTO:modules -->
[Source inventory](docs/index.md#source-inventory)

| Source root | Files |
| --- | --- |
| skills | 27 |
| scripts | 6 |
| tests | 34 |
| plugins | 11 |
<!-- /AUTO:modules -->

---

## Quality Gates

| Gate | Limit | Enforced By |
|------|-------|-------------|
| File size | 300 lines max per source file | `check-file-sizes.js` |
| Function length | 50 lines max (advisory) | Code review |
| Secrets | No API keys, tokens, private keys | `check-secrets.js` patterns: `sk-or-*`, `sk-ant-*`, `AKIA*`, `ghp_*`, `-----BEGIN.*PRIVATE KEY-----` |
| Test colocation | Every `src/` file needs a colocated test | `check-test-colocation.js` |
| Doc drift | CLAUDE.md must match actual codebase | `validate-docs.js --full` |
| Nesting depth | Max 5 nested if/else | Code review |
| Imports per file | Max 10 | Code review |

---

## Code Review Checklist

Before merging:
- [ ] No files over 300 lines (run `find . -name "*.js" -not -path "*/node_modules/*" -exec wc -l {} + | awk '$1 > 300'`)
- [ ] No hardcoded secrets (run `node skills/setup/scripts/lib/check-secrets.js`)
- [ ] Tests pass: `node --experimental-vm-modules node_modules/.bin/jest tests/scripts/`
- [ ] Doc validation passes: `node skills/setup/scripts/lib/validate-docs.js --full`
- [ ] CLAUDE.md updated if files were added, removed, or renamed
- [ ] Critical Gotchas section updated if non-obvious behavior was discovered

---

## Critical Gotchas

- **SKILL.md is the skill**: Claude Code reads the SKILL.md file as the skill prompt. Changes to SKILL.md directly change skill behavior.
- **Scripts run in target projects, not this repo**: The enforcement scripts in `skills/setup/scripts/` are templates copied into user projects by `/setup`. They must work standalone with zero dependencies on this repo.
- **Eval fixtures are intentionally broken**: `tests/evals/fixtures/level-1-bare/` contains a hardcoded secret on purpose for detection testing. Do not "fix" it.
- **No package.json at root**: This is a Claude Code plugin, not an npm package. Tests run via direct node/jest/bash invocation.
- **`globs:` not `paths:`**: Rule files use `globs:` in YAML frontmatter for path scoping. The official docs say `paths:` but `globs:` works more reliably (see Claude Code issue #17204).
- **Two sets of hooks**: `scripts/hooks/` are this repo's own git hooks (install with `bash scripts/install-hooks.sh`). `skills/setup/scripts/hooks/` are templates shipped to user projects by `/setup`. Don't confuse them.

---

## Documentation maintenance

Run `node scripts/repo-generate-docs.js` after file/doc metadata changes; review
and stage generated changes with intended inputs. Commit validation never writes
or stages. Keep explanatory prose current alongside implementation. Classify new
docs with title/description/type/status/read_when metadata; proposals/history are
not operational authority. See docs/self-documentation.md and the standalone
skill's metadata reference. The canonical scripts live under plugins/documentation;
full setup reuses their installer and target scripts work without the plugin cache.

<!-- AUTO:docs -->
[Documentation index](docs/index.md)
<!-- /AUTO:docs -->

## Docs Map

| Topic | File |
|-------|------|
| CLAUDE.md quality criteria | `skills/setup/references/claude-md-guide.md` |
| Enforcement script patterns | `skills/setup/references/enforcement-scripts.md` |
| Node/TypeScript stack reference | `skills/setup/references/stack-node-typescript.md` |
| Eval suite documentation | `tests/evals/README.md` |
