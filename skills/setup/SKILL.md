---
name: setup
description: Use when the user wants to set up a new project or add enforcement tooling (TDD, secret scanning, file size limits, git hooks, CLAUDE.md templates) to an existing project. Also use when the user says "bootstrap", "scaffold", "set up my project", or "add quality enforcement".
---

## Resource Resolution Preamble

Before any other step, resolve the skill's install directory:

```bash
SKILL_DIR=$(find ~/.claude/plugins -path "*/setup/SKILL.md" -print -quit | xargs dirname)
SCRIPTS_DIR=$SKILL_DIR/scripts
TEMPLATES_DIR=$SKILL_DIR/templates
REFERENCES_DIR=$SKILL_DIR/references
```

If `SKILL_DIR` is empty, halt and tell the user: "Could not locate the setup plugin directory under ~/.claude/plugins. Verify the plugin is installed."

---

## Phase 1: Detect Environment

Check the working directory for these manifest files: `package.json`, `pyproject.toml`, `CMakeLists.txt`, `go.mod`, `Cargo.toml`, `Makefile`.

Also check for: `.git/`, `src/`, existing `CLAUDE.md`.

Determine:
- **New project** — no manifest, no `.git/`, effectively an empty directory
- **Existing project** — manifest file present; infer language and stack from it

For existing projects, record the detected stack so Phase 2 questions can be skipped where answers are already known.

---

## Phase 2: Socratic Questions

Use the AskUserQuestion tool for each question, one at a time. Adapt or skip questions based on what was detected in Phase 1.

**Q1 — Purpose** (always ask):
"What are you building?" — understand whether this is a web app, REST API, CLI tool, data pipeline, ML project, firmware, mobile app, etc.

**Q2 — Language/stack** (skip if inferred from manifest):
"What language/stack would you like to use?"

Recommend based on the answer to Q1:
- UI/web app → Node/TypeScript (default recommendation)
- Backend API → Node/TypeScript or Python
- Data science / ML → Python
- Firmware / embedded → C/C++
- Systems programming or CLI → Go or Rust

**Q3 — Framework** (skip if inferred; options depend on stack chosen):
- Node/TS: Express, Fastify, Next.js, NestJS, or none
- Python: FastAPI, Flask, Django, or none
- Go: net/http, Gin, Echo, or none
- C/C++: ask about build system (CMake, Make, Meson) instead of framework

**Q4 — Project name** (new projects only):
"What should the project be called?" — suggest the current directory name as the default.

Do not ask about things you can infer. If the student says "firmware in C", ask about the build system, not web frameworks.

---

## Phase 3: Scaffold (new projects only)

Skip this phase entirely for existing projects.

**Node/TypeScript path (fast path — script does the work):**

```bash
node $SCRIPTS_DIR/init-project.js --name=<name> --framework=<framework>
```

**All other stacks (adaptive path — Claude does the work):**

1. `git init`
2. Create standard directories: `src/`, `tests/`, `scripts/`, `docs/`
3. Generate the appropriate manifest file:
   - Python: `pyproject.toml` with `[build-system]` and `[tool.pytest.ini_options]`
   - C/C++ with CMake: `CMakeLists.txt` with project name, C++ standard, and a test target
   - Go: `go.mod` with module path and Go version
   - Rust: `Cargo.toml` with package metadata
4. Install dependencies using the stack's package manager (pip, cmake, go mod tidy, cargo build)
5. Create a minimal `src/main.<ext>` entry point and a `tests/` placeholder

---

## Phase 4: Install Enforcement

Read `$REFERENCES_DIR/enforcement-scripts.md` first to understand the enforcement principles and the secret-scanning regex patterns before writing any scripts.

**Node/TypeScript path (fast path):**

```bash
node $SCRIPTS_DIR/install-enforcement.js --target=<project-root> --framework=<framework>
```

This also creates:
- `.claude/settings.json` with pre-approved commands (test, lint, build, git) and a deny list blocking destructive operations (rm -rf /, git push --force, etc.). Normal file removal still works — Claude prompts for approval so the user stays in control.
- `.claude/rules/*.md` — path-scoped rules (TDD, code quality, testing, TypeScript, and React for vite/nextjs) that auto-load when Claude works on matching file patterns. These use `globs:` YAML frontmatter for path-scoping.

**All other stacks (adaptive path — Claude creates equivalent enforcement):**

Use the equivalents table to choose the right tools:

| Enforcement     | Node/TS               | Python                    | C/C++              | Go              |
|-----------------|-----------------------|---------------------------|--------------------|-----------------|
| Linter          | ESLint                | ruff / flake8             | clang-tidy         | golangci-lint   |
| Formatter       | Prettier              | black / ruff              | clang-format       | gofmt           |
| Test runner     | Jest                  | pytest                    | CTest / GoogleTest | go test         |
| Pre-commit mgr  | husky + lint-staged   | pre-commit framework      | git hooks (shell)  | git hooks (shell) |

Steps for the adaptive path:
1. Write a secret-scanning script using the same regex patterns from `enforcement-scripts.md`, adapted to the stack's scripting language (Python script, shell script, etc.)
2. Write a file size checking script enforcing the 300-line limit
3. Create `scripts/lib/` directory and place both scripts there
4. Create `.git/hooks/pre-commit` — runs linter, formatter check, secret scanner, file size checker
5. Create `.git/hooks/pre-push` — runs the test suite with SHA-based caching to skip unchanged code
6. Make both hook files executable: `chmod +x .git/hooks/pre-commit .git/hooks/pre-push`
7. Install and configure the linter and formatter for the chosen stack
8. Create `.claude/settings.json` by copying `$TEMPLATES_DIR/settings.json` into the target project. Adjust the allow list entries to match the stack's commands (e.g., replace `npm test` with `pytest` for Python, `go test ./...` for Go)
9. Copy `.claude/rules/*.md` from `$TEMPLATES_DIR/rules/` into the target project. For non-TypeScript stacks, adapt `rules/typescript.md` to the relevant language conventions (e.g., PEP 8 for Python, Go naming conventions for Go)

---

## Phase 5: Generate CLAUDE.md

Read `$REFERENCES_DIR/claude-md-guide.md` first for quality guidelines — the goal is a dense, high-signal file where every line saves a future session from re-discovery.

Read `$TEMPLATES_DIR/project-claude.md` as the base pattern to follow.

**Node/TypeScript (if generate-claude-md.js exists):**

```bash
node $SCRIPTS_DIR/generate-claude-md.js --target=<project-root> --framework=<framework>
```

**All stacks (or if the script doesn't exist yet) — Claude generates CLAUDE.md directly:**

Adapt the template to include:
- **Commands section**: stack-appropriate build, test, lint, and format commands
- **Architecture section**: describe `src/`, `tests/`, `scripts/` layout and what goes where
- **Enforcement scripts section**: document the installed scripts and what triggers them
- **Quality gates**: 300-line file limit, 50-line function limit, complexity red flags (verbatim from global CLAUDE.md pattern)
- **Critical Gotchas section**: include the capture instruction — "When you hit a non-obvious issue, add it here immediately"
- **Code Review Checklist**: same checklist from the template
- **Writing Good CLAUDE.md Content section**: embed the key guidance so future agents know what to add here

If no global CLAUDE.md exists in the project's parent directory, read `$TEMPLATES_DIR/global-claude.md` and generate an adapted version for the detected stack.

---

## Phase 6: Verify Setup

Run a smoke test to confirm everything was installed correctly. Report each check as pass/fail and fix any failures before moving to the summary.

**1. Git hooks are executable:**
```bash
test -x .git/hooks/pre-commit && echo "PASS: pre-commit hook executable" || echo "FAIL: pre-commit hook not executable"
test -x .git/hooks/pre-push && echo "PASS: pre-push hook executable" || echo "FAIL: pre-push hook not executable"
```

**2. Enforcement scripts run without errors:**
Run each enforcement script in check/dry-run mode against the project. They should all exit 0 on a freshly scaffolded project.
- Secret scanner (should find no secrets in clean scaffolding)
- File size checker (no files should exceed 300 lines)

**3. CLAUDE.md exists and has required sections:**
Verify the file exists and contains at minimum: a Commands section, an Architecture section, and a Gotchas section.

**4. Agent config is valid:**
- `.claude/settings.json` exists and parses as valid JSON
- `.claude/settings.json` contains both `permissions.allow` and `permissions.deny` arrays
- At least one `.claude/rules/*.md` file exists with `globs:` in its YAML frontmatter

**5. Auto-documentation pipeline works:**
If `generate-docs.js` (or equivalent) was installed, run it and verify it completes without errors. This confirms that future commits will auto-update CLAUDE.md.

**6. Linter runs clean:**
Run the stack's linter on the scaffolded code. A freshly generated project should have zero lint errors.

If any check fails, fix the issue immediately (e.g., `chmod +x` a hook, regenerate a missing file). Then re-run the failing check to confirm the fix. Only proceed to the summary once all checks pass.

---

## Phase 7: Summary

After all phases complete and verification passes, output a summary that includes:

1. **What was installed** — list every file created or modified
2. **Verification results** — confirm all 6 checks passed
3. **Key commands** for the stack:
   - How to run tests
   - How to run the linter
   - How to make a commit (hooks fire automatically)
4. **TDD reminder**: "Write tests first. Red (failing test) → Green (passing) → Refactor. Never write implementation before a test exists."
5. **Suggested next steps**:
   - Fill in the `[bracketed placeholders]` in CLAUDE.md
   - Review and expand the Architecture section
   - Add the first real feature with a test
   - Make the first commit to initialize git history
