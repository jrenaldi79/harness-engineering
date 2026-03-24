# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

**harness-engineering** is a Claude Code plugin and reference for AI coding agent harnesses. It provides two skills (`/readiness` and `/setup`) that analyze and configure projects for agent-assisted development, plus a README mapping 20+ best practices from industry sources.

### Core Features

- **`/readiness`**: Scores a codebase across 8 pillars and 5 maturity levels, produces a saved report with delta tracking
- **`/setup`**: Scaffolds CLAUDE.md files, enforcement scripts, git hooks, linter configs, and agent settings via Socratic questioning
- **Reference guide**: Maps best practices from OpenAI, Anthropic, Augment Code, Factory.ai, and practitioners to concrete implementation patterns

---

## Essential Commands

### Testing
```bash
node --experimental-vm-modules node_modules/.bin/jest tests/scripts/   # Unit tests for setup scripts
bash tests/evals/run-evals.sh                                          # E2E readiness evals (default)
bash tests/evals/run-evals.sh --config setup-eval-config.json          # E2E setup evals
bash tests/evals/test-marketplace-install.sh                           # Test plugin install flow
```

### Validation
```bash
node skills/setup/scripts/lib/generate-docs.js --check   # Verify auto-generated sections are current
node skills/setup/scripts/lib/validate-docs.js --full     # Check for documentation drift
```

### Setup
```bash
bash scripts/install-hooks.sh   # Install git hooks (pre-commit + pre-push)
```

---

## Architecture

<!-- AUTO:tree -->
skills/
├── readiness/
│   └── SKILL.md
└── setup/
    ├── references/
    │   ├── claude-md-guide.md
    │   ├── enforcement-scripts.md
    │   └── stack-node-typescript.md
    ├── scripts/
    │   ├── hooks/
    │   │   ├── pre-commit
    │   │   └── pre-push
    │   ├── lib/
    │   │   ├── check-file-sizes.js  # File size enforcement script for pre-commit hook.
    │   │   ├── check-secrets.js  # Secret detection script for pre-commit hook.
    │   │   ├── check-test-colocation.js  # Test colocation enforcement script for pre-commit hook.
    │   │   ├── generate-docs-helpers.js  # Helper functions for generate-docs.js.
    │   │   ├── generate-docs.js  # Auto-generate CLAUDE.md sections from source code.
    │   │   └── validate-docs.js  # CLAUDE.md drift detection script.
    │   ├── generate-claude-md.js  # Generate tailored CLAUDE.md files for a project from templates.
    │   ├── init-project.js  # Project scaffolding script for Node/TypeScript projects.
    │   └── install-enforcement.js  # Copies enforcement tooling into a target project.
    ├── templates/
    │   ├── rules/
    │   │   ├── code-quality.md
    │   │   ├── react.md
    │   │   ├── tdd.md
    │   │   ├── testing.md
    │   │   └── typescript.md
    │   ├── eslint-base.js
    │   ├── gitignore-template
    │   ├── global-claude.md
    │   ├── lint-staged.config.js
    │   ├── project-claude.md
    │   └── settings.json
    └── SKILL.md
scripts/
├── hooks/
│   ├── pre-commit
│   └── pre-push
├── install-hooks.sh
├── README.md
└── repo-generate-docs.js  # Repo-level CLAUDE.md auto-generator.
tests/
├── evals/
│   ├── eval-config.json
│   ├── grader.js  # Readiness Skill Grader
│   ├── README.md
│   ├── run-evals.sh
│   ├── setup-eval-config.json
│   ├── setup-grader.js  # Setup Skill Grader
│   └── test-marketplace-install.sh
└── scripts/
    ├── detect-source-dirs.test.js  # Tests for detectSourceDirs and buildModuleIndex adaptive scanning.
    ├── generate-claude-md.test.js  # Tests for skills/setup/scripts/generate-claude-md.js
    ├── generate-docs-helpers.test.js  # Tests for generate-docs-helpers.js: directory trees, module indexes,
    ├── generate-docs.test.js  # Tests for generate-docs.js marker operations: replaceMarkers,
    ├── init-project.test.js  # Tests for skills/setup/scripts/init-project.js
    ├── install-enforcement.test.js  # Tests for skills/setup/scripts/install-enforcement.js
    ├── marketplace-schema.test.js  # Tests for .claude-plugin/marketplace.json schema validity.
    └── repo-generate-docs.test.js  # Tests for scripts/repo-generate-docs.js — the repo-level CLAUDE.md
<!-- /AUTO:tree -->

### Data Flow

```
User installs plugin
  -> /readiness reads templates/references as benchmark
  -> 3 parallel subagents evaluate project against 8 pillars
  -> Scored report saved to .claude/readiness-report.md

User runs /setup
  -> Socratic questions determine stack and goals
  -> Scripts scaffold project structure, configs, hooks
  -> Enforcement scripts copied to target project's scripts/
  -> Git hooks wired to run enforcement on every commit/push
```

---

## Key Modules

<!-- AUTO:modules -->
| Module | Purpose |
|--------|---------|
| `skills/readiness/SKILL.md` | Harness Readiness Report |
| `skills/setup/SKILL.md` | setup skill definition |
| `skills/setup/scripts/generate-claude-md.js` | Generate tailored CLAUDE.md files for a project from templates. |
| `skills/setup/scripts/init-project.js` | Project scaffolding script for Node/TypeScript projects. |
| `skills/setup/scripts/install-enforcement.js` | Copies enforcement tooling into a target project. |
| `skills/setup/scripts/lib/check-file-sizes.js` | File size enforcement script for pre-commit hook. |
| `skills/setup/scripts/lib/check-secrets.js` | Secret detection script for pre-commit hook. |
| `skills/setup/scripts/lib/check-test-colocation.js` | Test colocation enforcement script for pre-commit hook. |
| `skills/setup/scripts/lib/generate-docs-helpers.js` | Helper functions for generate-docs.js. |
| `skills/setup/scripts/lib/generate-docs.js` | Auto-generate CLAUDE.md sections from source code. |
| `skills/setup/scripts/lib/validate-docs.js` | CLAUDE.md drift detection script. |
| `scripts/install-hooks.sh` | Install git hooks for harness-engineering repo. |
| `scripts/repo-generate-docs.js` | Repo-level CLAUDE.md auto-generator. |
| `tests/evals/grader.js` | Readiness Skill Grader |
| `tests/evals/run-evals.sh` | run-evals.sh |
| `tests/evals/setup-grader.js` | Setup Skill Grader |
| `tests/evals/test-marketplace-install.sh` | test-marketplace-install.sh |
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

## Docs Map

| Topic | File |
|-------|------|
| CLAUDE.md quality criteria | `skills/setup/references/claude-md-guide.md` |
| Enforcement script patterns | `skills/setup/references/enforcement-scripts.md` |
| Node/TypeScript stack reference | `skills/setup/references/stack-node-typescript.md` |
| Eval suite documentation | `tests/evals/README.md` |
