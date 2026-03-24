---
generated: 2026-03-24
level: 3
level_name: Enforced
score: 17
total: 37
stack: node-javascript
monorepo: false
pillars:
  style-validation: { pass: 0, total: 4 }
  testing: { pass: 3, total: 5 }
  git-hooks: { pass: 2, total: 5 }
  documentation: { pass: 6, total: 9 }
  agent-config: { pass: 0, total: 5 }
  code-quality: { pass: 3, total: 3 }
  dev-environment: { pass: 1, total: 3 }
  agentic-workflow: { pass: 2, total: 2 }
---

# Harness Readiness Report

**Project:** harness-engineering (Node.js / Claude Code plugin)
**Level:** 3 / 5 (Enforced)
**Score:** 17 / 36 criteria passing

## Pillar Scores

Style & Validation    ░░░░░░ 0/4
Testing               ████░░ 3/5
Git Hooks             ██░░░░ 2/5
Documentation         ████░░ 6/9
Agent Configuration   ░░░░░░ 0/5
Code Quality          ██████ 3/3
Dev Environment       ██░░░░ 1/3
Agentic Workflow      ██████ 2/2

## Passing

- ✓ Test runner configured (Jest, `node --experimental-vm-modules jest tests/scripts/`)
- ✓ Test files mirror source files (`tests/scripts/` mirrors `skills/setup/scripts/`)
- ✓ Tests pass (5 unit test files, eval suite with 3 fixtures)
- ✓ Secret scanning configured (check-secrets.js, runs in CI workflow)
- ✓ File size limits enforced (check-file-sizes.js, runs in CI workflow)
- ✓ CLAUDE.md exists (108 lines, well-scoped)
- ✓ Has Commands section (6 commands, copy-paste ready)
- ✓ Has Architecture section (tree, key modules table, data flow)
- ✓ Has Critical Gotchas section (5 project-specific, non-obvious discoveries)
- ✓ No drift (all 11+ documented paths verified to exist on disk)
- ✓ Content quality (dense, specific, actionable, no generic boilerplate)
- ✓ No source files over 300 lines (all scripts under limit)
- ✓ No hardcoded secrets in source (only intentional one in eval fixture)
- ✓ Consistent code style across codebase
- ✓ Build/dev commands documented and functional
- ✓ Workflow system present (/readiness and /setup skills with structured phases)
- ✓ Session-start validation documented (validate-docs.js referenced in CLAUDE.md)

## Failing

- ✗ Linter not configured for this repo (ships ESLint templates to users but no eslint config at root)
- ✗ Formatter not configured for this repo (ships Prettier template but no .prettierrc at root)
- ✗ Lint-on-commit not configured (no lint-staged for this repo)
- ✗ No default exports rule not enforced (no ESLint running)
- ✗ Coverage threshold not configured
- ✗ TDD enforcement rule missing (no .claude/rules/tdd.md at root)
- ✗ Pre-commit hook not installed (.git/hooks/ has only .sample files)
- ✗ Pre-push hook not installed (template exists but not wired)
- ✗ Smart test caching not active (template has SHA-based caching but not installed)
- ✗ Quality gates not documented in CLAUDE.md (limits embedded in table, not summarized)
- ✗ Code review checklist missing from CLAUDE.md
- ✗ AUTO markers not used (repo doesn't dogfood its own auto-generation feature)
- ✗ .claude/settings.json does not exist at repo root
- ✗ Allow list not configured (no settings.json)
- ✗ Deny list not configured (no settings.json)
- ✗ Path-scoped rules missing (no .claude/rules/ at root)
- ✗ Enforcement hierarchy incomplete (CI + prose, but no path-scoped rules layer)
- ✗ .env.example missing at root
- ✗ No package.json at root (dependencies not formally declared)
