# Enforcement Scripts Reference

Reference for Claude when explaining or adapting enforcement scripts installed by `/setup`. All scripts live in `scripts/lib/` after installation and are invoked by git hooks.

---

## Script Details

### check-secrets.js

Scans staged files for hardcoded API keys and private key material. Exits 1 if any pattern matches, blocking the commit.

**CONFIG object:**
```js
const CONFIG = {
  patterns: [
    { regex: /sk-or-[\w-]{3,}/g,             description: 'OpenRouter API key' },
    { regex: /sk-ant-[\w-]{3,}/g,            description: 'Anthropic API key' },
    { regex: /AKIA[0-9A-Z]{16}/g,            description: 'AWS access key' },
    { regex: /ghp_[A-Za-z0-9_]{10,}/g,      description: 'GitHub personal access token' },
    { regex: /-----BEGIN\s[\w\s]*?PRIVATE\sKEY-----/g, description: 'Private key block' },
  ],
  allowlistPaths: [
    'tests/**',
    '**/*.test.js',
    '**/*.spec.js',
    '**/*.md',
    'docs/**',
  ],
};
```

**Allowlist mechanism:** Files whose path matches any allowlist glob are skipped entirely. The match is done with a simple glob-to-regex conversion (`**` → `.*`, `*` → `[^/]*`). Test files and documentation are allowlisted by default so fixture data and example keys don't block commits.

**To add a new secret pattern:** append to `CONFIG.patterns` with a `regex`, `name`, and `description`. The `name` field is displayed in the error message.

**To allowlist a path:** add a glob to `CONFIG.allowlistPaths`, e.g. `'vendor/**'`.

---

### check-file-sizes.js

Enforces a 300-line limit on source files in `src/`. Exits 1 if any staged file exceeds the limit.

**CONFIG object:**
```js
const CONFIG = {
  maxLines: 300,
  include: ['src/**/*.js'],
  exclude: [],
};
```

**How it counts lines:** splits content on `\n` and subtracts 1 if the file ends with a newline (trailing newline is not a real line).

**To change the limit:** update `CONFIG.maxLines`.

**To include TypeScript files:** change `include` to `['src/**/*.js', 'src/**/*.ts']`.

**To exclude generated files:** add globs to `CONFIG.exclude`, e.g. `['src/generated/**']`.

---

### validate-docs.js

CLAUDE.md drift detection. Compares what's documented against what's on disk.

**Two modes:**

- **Pre-commit (default):** Checks whether staged files touch `src/`, `bin/`, or `scripts/` without also staging `CLAUDE.md`. If so, prints a warning (does not block the commit).
- **Full analysis (`--full`):** Reads the `Directory Structure` and `Key Modules` sections of `CLAUDE.md` and compares the filenames mentioned there against actual files on disk. Exits 1 if there is drift.

**CONFIG object:**
```js
const CONFIG = {
  docFile: 'CLAUDE.md',
  trackedDirs: ['src/', 'bin/', 'scripts/'],
  mappings: [
    { section: 'Directory Structure', dirs: ['src/', 'bin/', 'scripts/'] },
    { section: 'Key Modules',         dir: 'src/', pattern: /\.js$/ },
  ],
};
```

**To track a new directory:** add it to `CONFIG.trackedDirs` and add a mapping to `CONFIG.mappings`.

**Usage:**
```bash
node scripts/validate-docs.js         # pre-commit mode
node scripts/validate-docs.js --full  # full drift analysis
```

---

### Documentation capability

The full installer delegates to the self-contained documentation skill under
`plugins/documentation/skills/documentation/`. It copies the canonical scripts to
`scripts/self-documentation/`; `scripts/generate-docs.js` is only a compatibility
launcher. Legacy helper exports remain in this repository for existing consumers,
but are not installed as a second project generator.

Refresh inventories/indexes explicitly; review and stage output with its inputs.
Use `--check` for read-only working-tree validation and `--staged` for the exact
Git index. Never auto-stage. Source inventories read filenames only. Document
metadata and classifications come from frontmatter/catalog, not inferred policy.
Read the documentation skill's metadata reference for its bounded grammar and
explicit catalog migration. Keep authored prose current in the same code change.

---

## Git Hook Chain

### pre-commit (fast, <2s)

```bash
npx lint-staged                  # ESLint + Prettier on staged files
node scripts/check-secrets.js    # block if secrets found
node scripts/check-file-sizes.js # block if file >300 lines
node scripts/self-documentation/generate.js --staged # validate the staged snapshot
node scripts/validate-docs.js    # warn if CLAUDE.md may need updating
```

### pre-push (thorough)

```bash
# SHA-based test cache: skip if tests already passed for HEAD
if HEAD_SHA == $(cat .test-passed); then skip
else npm run test:all

npm audit --audit-level=moderate  # warn only, does not block push
```

The `.test-passed` file stores the SHA of the last commit for which the full test suite passed. This avoids re-running tests on every push for the same commit.

---

## Adapting to Non-Node Stacks

### Secret scanning

The regex patterns in `check-secrets.js` operate on raw text and work on any file type. To reimplement for a non-Node stack:

- **Shell script:** use `grep -P` with the same patterns, loop over `git diff --cached --name-only`
- **Python:** use the `re` module with the same patterns; call from a `.git/hooks/pre-commit` script

The allowlist logic is a simple glob match — trivial to reimplement in any language.

### File size limits

Line counting is language-agnostic. To adapt:

- Change `include` globs to match the target language (e.g. `['src/**/*.py']` for Python, `['**/*.go']` for Go)
- The 300-line limit applies to any language — adjust `maxLines` if needed
- In a non-Node project, replace the Node script with a shell one-liner: `wc -l <file>`

### Pre-commit hooks

The git hook mechanism (`hooks/pre-commit`) is the same regardless of language. Replace Node invocations with the appropriate tools:

| Node command | Equivalent for other stacks |
|---|---|
| `npx lint-staged` + ESLint | `ruff check --fix` (Python), `golangci-lint run` (Go) |
| `jest` / `npm test` | `pytest`, `go test ./...` |
| `tsc --noEmit` | `mypy src/`, `go vet ./...` |

### Doc generation

The standalone documentation runtime uses Node.js 18+ in every project, including
Python, Go, and Rust projects. It has no npm dependencies and reads source filenames
only, so full setup uses the same installer and staged validation for every stack.
Keep authored module explanations current alongside code changes; inventories do
not infer API semantics or replace prose review.
