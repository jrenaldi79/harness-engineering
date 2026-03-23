# Enforced Project

## Commands

- `npm run build` — Compile TypeScript
- `npm test` — Run tests with coverage
- `npm run lint` — Lint source files
- `npm run format` — Format with Prettier
- `npm run dev` — Dev mode with file watching

## Architecture

```
src/
  index.ts        — Entry point
  greeter.ts      — Core greeting logic
  greeter.test.ts — Colocated tests
```

## Critical Gotchas

- Always run `npm test` before pushing — pre-push hook enforces this
- TypeScript strict mode is enabled — no implicit `any`
