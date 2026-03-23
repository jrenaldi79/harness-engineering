# Autonomous Project

## Commands

- `npm run build` — Compile TypeScript to `dist/`
- `npm test` — Run Jest with coverage (80% threshold)
- `npm run test:watch` — Watch mode for TDD
- `npm run lint` — ESLint check
- `npm run lint:fix` — ESLint auto-fix
- `npm run format` — Prettier format all source
- `npm run format:check` — Prettier check (CI mode)
- `npm run dev` — Dev server with hot reload
- `npm run typecheck` — TypeScript type check without emit

## Architecture

<!-- AUTO:architecture -->
```
src/
  index.ts              — Entry point, starts Express server
  app.ts                — Express app factory (createApp)
  app.test.ts           — App integration tests
  routes/
    health.ts           — GET /health endpoint
    health.test.ts      — Health endpoint tests
    users.ts            — CRUD /users endpoints
    users.test.ts       — Users endpoint tests
```
<!-- /AUTO:architecture -->

## Critical Gotchas

- TypeScript strict mode is ON — no implicit `any`, null checks required
- Pre-push hook has smart test caching — uses `.test-passed` SHA file to skip redundant runs
- Secret scanning runs on every commit via pre-commit hook
- File size limit is 300 lines per source file — enforced by pre-push hook AND `.claude/rules/code-quality.md`
- Coverage threshold is 80% on branches, functions, lines, and statements

## Quality Gates

- **File size:** 300-line max for source files (enforced by `.claude/scripts/check-file-sizes.js`)
- **Function length:** 50-line max (advisory, in `.claude/rules/code-quality.md`)
- **Coverage:** 80% minimum on all metrics
- **No default exports** (enforced by eslint `import/no-default-export` rule)

## Code Review Checklist

- [ ] Tests written first (TDD)
- [ ] Coverage maintained above 80%
- [ ] No files over 300 lines
- [ ] No hardcoded secrets
- [ ] Types are strict — no `any` casts
- [ ] Named exports only
