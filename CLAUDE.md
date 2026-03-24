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
bash tests/evals/run-evals.sh                                          # E2E evals against fixture projects
node tests/evals/grader.js                                             # Grade eval results
bash tests/evals/test-marketplace-install.sh                           # Test plugin install flow
```

### Validation
```bash
node skills/setup/scripts/lib/generate-docs.js --check   # Verify auto-generated sections are current
node skills/setup/scripts/lib/validate-docs.js --full     # Check for documentation drift
```

---

## Architecture

```
harness-engineering/
├── .claude-plugin/          # Plugin manifest (plugin.json, marketplace.json)
├── skills/
│   ├── readiness/
│   │   └── SKILL.md         # Readiness analysis skill (8 pillars, 5 levels)
│   └── setup/
│       ├── SKILL.md          # Setup orchestrator skill (6 phases)
│       ├── scripts/          # Node.js enforcement scripts installed into target projects
│       │   ├── lib/          # Individual checks (secrets, file sizes, test colocation, docs)
│       │   └── hooks/        # Git hook scripts (pre-commit, pre-push)
│       ├── templates/        # Config templates (.prettierrc, eslint, CLAUDE.md, rules/)
│       └── references/       # Stack patterns, enforcement docs, quality guide
├── tests/
│   ├── scripts/              # Unit tests for setup scripts (Jest)
│   └── evals/                # E2E evaluation suite with 3 fixture projects (level 1/3/5)
├── assets/                   # Pipeline diagram SVG, social images
└── README.md                 # Reference guide and documentation
```

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

| Module | Purpose |
|--------|---------|
| `skills/readiness/SKILL.md` | Full evaluation framework, 8 pillars, 37 criteria, 3 subagent dispatch |
| `skills/setup/SKILL.md` | 6-phase setup orchestrator with Socratic discovery |
| `scripts/init-project.js` | Node/TS project scaffolding (package.json, tsconfig, directories) |
| `scripts/install-enforcement.js` | Copies enforcement scripts, hooks, configs into target project |
| `scripts/generate-claude-md.js` | Generates tailored CLAUDE.md from templates |
| `scripts/lib/check-secrets.js` | Pattern-matches API keys, tokens, private keys in staged files |
| `scripts/lib/check-file-sizes.js` | Rejects files over 300 lines |
| `scripts/lib/check-test-colocation.js` | Verifies source files have colocated test files |
| `scripts/lib/generate-docs.js` | Auto-regenerates CLAUDE.md sections between AUTO markers |
| `scripts/lib/validate-docs.js` | Detects drift between source code and CLAUDE.md content |

---

## Critical Gotchas

- **SKILL.md is the skill**: Claude Code reads the SKILL.md file as the skill prompt. Changes to SKILL.md directly change skill behavior.
- **Scripts run in target projects, not this repo**: The enforcement scripts in `skills/setup/scripts/` are templates copied into user projects by `/setup`. They must work standalone with zero dependencies on this repo.
- **Eval fixtures are intentionally broken**: `tests/evals/fixtures/level-1-bare/` contains a hardcoded secret on purpose for detection testing. Do not "fix" it.
- **No package.json at root**: This is a Claude Code plugin, not an npm package. Tests run via direct node/jest/bash invocation.
- **`globs:` not `paths:`**: Rule files use `globs:` in YAML frontmatter for path scoping. The official docs say `paths:` but `globs:` works more reliably (see Claude Code issue #17204).

---

## Docs Map

| Topic | File |
|-------|------|
| CLAUDE.md quality criteria | `skills/setup/references/claude-md-guide.md` |
| Enforcement script patterns | `skills/setup/references/enforcement-scripts.md` |
| Node/TypeScript stack reference | `skills/setup/references/stack-node-typescript.md` |
| Eval suite documentation | `tests/evals/README.md` |
