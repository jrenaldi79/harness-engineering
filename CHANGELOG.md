# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
