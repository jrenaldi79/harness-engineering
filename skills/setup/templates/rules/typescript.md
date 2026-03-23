---
globs: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.js"]
---
# Naming Conventions & Import Practices

## Naming Conventions
- Use meaningful and descriptive names for variables, functions, and components
- Use PascalCase for type names and interfaces
- Use camelCase for variables and functions
- Use UPPER_CASE for constants
- Use lowercase with dashes for directories (e.g., `utils/auth-helper`)

## TypeScript Import/Export Best Practices
- **Use named exports, not default exports.** Default exports let consumers pick any name, so `grep` can't reliably find where something is used. Named exports mean `createUser` is always `createUser` everywhere — agents can search/replace with confidence during multi-file refactors. Enforced by ESLint `import/no-default-export`.
- **Prefer absolute imports over relative paths.** `../../../utils/auth` breaks when you move a file and agents are bad at counting `../` levels. Configure `tsconfig.json` path aliases (e.g., `@app/utils/auth`) so imports work from anywhere. This requires per-project setup — add a `paths` entry in `tsconfig.json`.
- Use explicit `type` imports for TypeScript types
- Use explicit file paths for type imports (include `/index`)
- When encountering module resolution errors, check import syntax, file extensions, and `tsconfig.json` paths
- Prefer explicit imports over barrel exports for better tree-shaking
