---
name: readiness
description: >
  Use when the user wants to analyze, audit, or assess their codebase for AI agent readiness.
  Also use for "readiness report", "how ready is my project", "analyze my codebase",
  "audit my repo", "check my setup", or "what should I improve".
---

## Resource Resolution Preamble

Before any other step, resolve both the readiness skill's directory and the setup skill's resources:

```bash
SKILL_DIR=$(find ~/.claude/plugins -path "*/readiness/SKILL.md" -print -quit | xargs dirname)
SETUP_SKILL_DIR=$(find ~/.claude/plugins -path "*/setup/SKILL.md" -print -quit | xargs dirname)
SETUP_SCRIPTS=$SETUP_SKILL_DIR/scripts
SETUP_TEMPLATES=$SETUP_SKILL_DIR/templates
SETUP_REFERENCES=$SETUP_SKILL_DIR/references
```

If `SKILL_DIR` is empty, halt and tell the user: "Could not locate the readiness plugin directory under ~/.claude/plugins. Verify the plugin is installed."

If `SETUP_SKILL_DIR` is empty, halt and tell the user: "Could not locate the setup plugin directory. The readiness skill requires the setup skill to be installed as part of the same plugin."

The setup skill's files are **references only** — read them to understand what good enforcement looks like, but never blindly run install scripts on an existing project.

---

## Phase 1: Detect Environment & Load Previous Report

Check the working directory for:

**Manifest files:** `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `CMakeLists.txt`, `Makefile`

**Git:** `.git/` exists

**Existing agent config:** `CLAUDE.md`, `AGENTS.md`, `.claude/`, `.cursor/`

**Stack detection:** Infer language, framework, and package manager from manifest contents.

**Monorepo detection:** Check for:
- `package.json` → `workspaces` field
- `pnpm-workspace.yaml`
- `Cargo.toml` → `[workspace]`
- Go workspace (`go.work`)
- Lerna (`lerna.json`), Nx (`nx.json`), Turborepo (`turbo.json`)

If monorepo: identify each app/package as a separate scoring unit.

**Previous report:** Check for `readiness-report.md`. If present, read the YAML frontmatter to enable delta comparison at the end.

---

## Phase 2: Parallel Subagent Evaluation

Use subagents to keep the main context clean. Each subagent receives:
1. The specific **reference file paths** it needs (resolved from the preamble)
2. The **project path** to evaluate
3. The **stack info** detected in Phase 1
4. Its **pillar criteria** to evaluate (from Phase 3 below)
5. Whether this is a **monorepo** and if so, the list of app/package paths

Launch **3 subagents in parallel**, each covering related pillars:

### Subagent 1: Style, Testing & Code Quality

**Reference files to read first:**
- `$SETUP_REFERENCES/enforcement-scripts.md` — secret scanning patterns, file size rules
- `$SETUP_SCRIPTS/lib/check-file-sizes.js` — 300-line limit implementation
- `$SETUP_SCRIPTS/lib/check-secrets.js` — secret patterns to scan for
- `$SETUP_SCRIPTS/lib/check-test-colocation.js` — test colocation rules

**Evaluates:** Pillar 1 (Style & Validation), Pillar 2 (Testing), Pillar 6 (Code Quality)

### Subagent 2: Hooks, Config, Environment & Workflow

**Reference files to read first:**
- `$SETUP_SCRIPTS/hooks/pre-commit` — what a good pre-commit hook runs (project hooks may live in `.git/hooks/` or `.husky/`)
- `$SETUP_SCRIPTS/hooks/pre-push` — what a good pre-push hook runs (project hooks may live in `.git/hooks/` or `.husky/`)
- `$SETUP_TEMPLATES/settings.json` — what a good settings file looks like
- `$SETUP_TEMPLATES/rules/*.md` — what path-scoped rules look like

**Evaluates:** Pillar 3 (Git Hooks & Enforcement), Pillar 5 (Agent Configuration), Pillar 7 (Dev Environment), Pillar 8 (Agentic Workflow)

### Subagent 3: Documentation

**Reference files to read first:**
- `$SETUP_TEMPLATES/project-claude.md` — what a well-structured CLAUDE.md contains
- `$SETUP_TEMPLATES/global-claude.md` — what global guidance contains
- `$SETUP_REFERENCES/claude-md-guide.md` — quality criteria for CLAUDE.md content
- `$SETUP_SCRIPTS/lib/validate-docs.js` — drift detection logic
- `$SETUP_SCRIPTS/lib/generate-docs.js` — auto-generation patterns

**Evaluates:** Pillar 4 (Documentation)

### Subagent Return Format

Each subagent returns a structured JSON result:

```json
{
  "pillars": {
    "pillar-name": {
      "criteria": [
        { "name": "Linter configured", "pass": true, "evidence": "Found eslint.config.js with 12 rules" },
        { "name": "Formatter configured", "pass": false, "evidence": "No prettier/black/gofmt config found" }
      ]
    }
  },
  "insights": [
    "Tests exist but 4 of 12 test files contain only TODO stubs — technically passing but not testing anything",
    "CLAUDE.md has a Commands section but lists npm scripts that don't exist in package.json"
  ]
}
```

The `insights` array captures nuanced observations that go beyond pass/fail — things only an intelligent agent would notice.

---

## Phase 3: Pillar Criteria Reference

This section defines what each subagent evaluates. Each criterion is **binary pass/fail with evidence** — cite the specific file, config, or absence found.

For monorepos: **repo-scoped** criteria are evaluated once across the whole repo. **App-scoped** criteria are evaluated per app/package.

### Pillar 1: Style & Validation (repo-scoped)

- [ ] Linter configured with a run command (eslint, ruff, golangci-lint, clang-tidy, clippy, etc.)
- [ ] Formatter configured (prettier, black, gofmt, clang-format, rustfmt, etc.)
- [ ] Lint-on-commit configured (lint-staged, pre-commit framework, or equivalent)
- [ ] No default exports rule (JS/TS only — `import/no-default-export` or equivalent)

### Pillar 2: Testing (app-scoped)

- [ ] Test runner configured with a run command (jest, pytest, go test, cargo test, etc.)
- [ ] Test files exist alongside or mirroring source files (colocation)
- [ ] Coverage threshold configured
- [ ] Tests actually pass (run them)
- [ ] **TDD enforcement** — a dedicated TDD rule file exists (e.g., `.claude/rules/tdd.md`) that enforces test-first development as a process, not just test existence

### Pillar 3: Git Hooks & Enforcement (repo-scoped)

- [ ] Pre-commit hook exists and runs checks (check `.git/hooks/pre-commit` OR `.husky/pre-commit` — either location counts) covering linting, formatting, secret scanning
- [ ] Pre-push hook exists and runs tests (check `.git/hooks/pre-push` OR `.husky/pre-push` — either location counts)
- [ ] Secret scanning configured — a script or tool that blocks commits containing API keys, tokens, or private keys, wired into the pre-commit hook at `.git/hooks/pre-commit` or `.husky/pre-commit` (reference the patterns in `check-secrets.js`)
- [ ] File size limits enforced mechanically — commits blocked if source files exceed a line limit, wired into the pre-commit hook at `.git/hooks/pre-commit` or `.husky/pre-commit` (reference `check-file-sizes.js`)
- [ ] **Smart test caching** — pre-push hook (at `.git/hooks/pre-push` or `.husky/pre-push`) uses SHA-based caching to skip test runs when HEAD hasn't changed (`.test-passed` file or equivalent)

### Pillar 4: Documentation (app-scoped)

Compare the project's CLAUDE.md (or AGENTS.md) against `$SETUP_TEMPLATES/project-claude.md` section-by-section. Use `$SETUP_REFERENCES/claude-md-guide.md` for quality criteria: dense, high-signal content where every line saves a future session from re-discovery.

- [ ] CLAUDE.md or AGENTS.md exists
- [ ] Has **Commands section** — lists build, test, lint, dev commands (compare against template)
- [ ] Has **Architecture section** — describes directory structure, key modules, data flow (compare against template)
- [ ] Has **Critical Gotchas section** — captures non-obvious discoveries that prevent re-debugging ("When you hit a non-obvious issue, add it here immediately")
- [ ] Has **Quality gates** documented — file size limits, function length limits, complexity red flags
- [ ] Has **Code Review Checklist** — or equivalent quality checks
- [ ] **Auto-generated sections** — uses `<!-- AUTO:name -->` markers for sections that should stay in sync with code (or equivalent automation)
- [ ] **No drift** — documented structure matches actual codebase (compare what CLAUDE.md says about directories/files vs. what actually exists on disk)
- [ ] **Content quality** — sections contain actionable, specific information, not generic boilerplate. Apply `claude-md-guide.md` criteria: commands that save re-discovery, gotchas that prevent repeat debugging, config quirks that aren't obvious from code

### Pillar 5: Agent Configuration (repo-scoped)

- [ ] `.claude/settings.json` (or equivalent agent config) exists
- [ ] Allow list covers standard dev commands (test, lint, build, git operations)
- [ ] Deny list blocks destructive operations (rm -rf /, git push --force, git reset --hard, etc.)
- [ ] Path-scoped rules exist (`.claude/rules/` directory with rule files that use `globs:` frontmatter for file-pattern matching)
- [ ] **Enforcement hierarchy** — mechanical enforcement (hooks) backs up advisory rules, which back up CLAUDE.md prose. Check that things stated in rules are also enforced by hooks where possible (e.g., "300-line limit" appears in both a rule file AND a hook script)

### Pillar 6: Code Quality (app-scoped)

- [ ] No source files over 300 lines (scan `src/`, `lib/`, or equivalent directories)
- [ ] No obvious hardcoded secrets in source (apply patterns from `check-secrets.js`: `sk-or-*`, `sk-ant-*`, `AKIA*`, `ghp_*`, `-----BEGIN.*PRIVATE KEY-----`)
- [ ] Consistent code style across the codebase (agent judgment — look for mixed conventions, inconsistent naming, etc.)

### Pillar 7: Dev Environment (repo-scoped)

- [ ] `.env.example` or equivalent environment template exists
- [ ] Build/dev commands are documented and functional
- [ ] Dependencies install cleanly (run the install command and check for errors)

### Pillar 8: Agentic Workflow (repo-scoped)

Check whether a structured plan-before-build workflow system is installed.

- [ ] **Workflow system present** — detect any of these (or similar agentic workflow tools) that include a planning phase before implementation:
  - **BMAD** — `_bmad/` directory, `_bmad-output/`, or BMAD skills in `.claude/skills/`
  - **Superpowers** — skills with `superpowers:` prefix (brainstorm, write-plan, execute-plan)
  - **gStack** — `.claude/skills/gstack/` directory or `~/.claude/skills/gstack/`
  - **Other** — any SKILL.md files that provide planning, review, or structured development phases
- [ ] **Session-start validation** — some mechanism exists to validate project state at the start of a work session. Examples: `validate-docs.js --full` instruction in CLAUDE.md, a session-start hook, a SessionStart hook in settings, or a skill that audits state before coding begins

If no agentic workflow system is detected, recommend **Superpowers** as the default:
- Install: `/plugin install superpowers@claude-plugins-official`
- Provides: brainstorming, planning, TDD enforcement, code review, debugging, testing, shipping phases
- GitHub: `github.com/obra/superpowers`

---

## Phase 4: Score & Level

After all 3 subagents return, merge their results into a unified scorecard in the main context.

**Scoring rules:**
- Per-pillar score: passing criteria / total criteria
- Level unlock: must pass **80% of criteria at that level + 100% of all previous levels**
- Levels are cumulative — no cherry-picking

| Level | Name | Requirements |
|---|---|---|
| 1 | Bare | Has manifest + git. That's it. |
| 2 | Basic | Linter + formatter + test runner exist and work. |
| 3 | Enforced | Git hooks block bad commits. CLAUDE.md exists with essential sections. Agent settings configured. |
| 4 | Automated | Auto-generated docs, drift detection, path-scoped rules, smart test caching. Agentic workflow system installed. |
| 5 | Autonomous | Full harness coverage. TDD enforced. Docs in sync. Plan-before-build + session-start validation active. Agent can work for hours without going off the rails. |

**Monorepo scoring:** Show per-app scores for app-scoped pillars (e.g., "Testing: 3/4 apps pass"). Overall level is gated by the weakest app — all apps must meet the level threshold.

---

## Phase 5: Output — Two Parts

### Part A: Structured Report (saved to `readiness-report.md`)

Write the report with YAML frontmatter for machine-parseable delta tracking on future runs.

```yaml
---
generated: YYYY-MM-DD
level: 2
level_name: Basic
score: 12
total: 37
stack: node-typescript
monorepo: false
pillars:
  style-validation: { pass: 3, total: 4 }
  testing: { pass: 2, total: 5 }
  git-hooks: { pass: 0, total: 5 }
  documentation: { pass: 2, total: 9 }
  agent-config: { pass: 1, total: 5 }
  code-quality: { pass: 3, total: 3 }
  dev-environment: { pass: 1, total: 3 }
  agentic-workflow: { pass: 0, total: 2 }
---

# Harness Readiness Report

**Project:** <name> (<stack>)
**Level:** X / 5 (<level-name>)
**Score:** X / 36 criteria passing
**Delta:** +N since last report (was Level X)     ← only if previous report exists

## Pillar Scores

Style & Validation    ████░░ X/4
Testing               ███░░░ X/5
Git Hooks             ░░░░░░ X/5
Documentation         ██░░░░ X/9
Agent Configuration   █░░░░░ X/5
Code Quality          ██████ X/3
Dev Environment       ██░░░░ X/3
Agentic Workflow      ░░░░░░ X/2

## Monorepo Breakdown                    ← only if monorepo
| Package | Level | Score |
|---|---|---|
| packages/api | 3 | 25/37 |
| packages/web | 2 | 18/37 |

## Passing
- ✓ <criterion> (<evidence>)
- ...

## Failing
- ✗ <criterion> — <what's missing>
- ...

## Changes Since Last Report              ← only if previous report exists
- ↑ Now passing: <criteria that improved>
- ↓ Regressed: <criteria that went from pass to fail, or "none">
```

Use the Unicode block characters for the progress bars:
- `█` for each passing unit (proportional to total)
- `░` for each failing unit
- Scale each bar to 6 characters wide regardless of the pillar's total criteria count

### Part B: Conversational Insights (in the chat, not saved to file)

After writing the structured report, provide **prose analysis** in the conversation:

1. **What's working well** — acknowledge strengths and explain why they matter
2. **Highest-impact gaps** — explain the cost of each gap (e.g., "Without a pre-commit hook, every bad commit gets caught in CI instead of locally — wasting 5-10 minutes per cycle")
3. **Nuanced observations** — things the checklist can't capture, drawn from the subagents' `insights` arrays (e.g., "Your tests exist but 4 of 12 are stubs with TODO comments — technically passing but not actually testing anything")
4. **Stack-specific notes** — any observations specific to the detected language/framework

---

## Phase 6: Remediation Recommendations

Provide **surgical, context-aware recommendations** — not "run /setup" but specific actions that respect what already exists.

### Surgical vs. Blunt Recommendations

| Gap | Blunt (wrong) | Surgical (right) |
|---|---|---|
| No Commands section in CLAUDE.md | "Run `/setup` to generate CLAUDE.md" | "Add a Commands section to your existing CLAUDE.md listing your build/test/lint commands. See `$SETUP_TEMPLATES/project-claude.md` for the pattern." |
| No pre-commit hook | "Install husky" | "Your project uses lint-staged but has no hook trigger. Add a pre-commit hook that runs lint-staged + secret scanning. See `$SETUP_SCRIPTS/hooks/pre-commit` for a reference implementation." |
| No settings.json | "Run /setup" | "Create `.claude/settings.json` based on your existing npm scripts. Allow: test, lint, build. Deny: force push, rm -rf. See `$SETUP_TEMPLATES/settings.json` for the template." |
| CLAUDE.md exists but no Architecture section | "Regenerate CLAUDE.md" | "Add an Architecture section to your existing CLAUDE.md describing your current directory layout and key modules." |
| No agentic workflow | "Figure it out" | "Install Superpowers for structured development phases: `/plugin install superpowers@claude-plugins-official`" |

### Prioritization

Order recommendations by impact — fixes that unlock the **next maturity level** come first. Group them:

1. **To reach Level N** (next level) — the minimum fixes needed
2. **Quick wins** — easy fixes with high payoff (e.g., adding `.env.example`)
3. **Deeper improvements** — things that require more effort but compound over time

### Offer to Apply

After presenting recommendations, ask: **"Want me to apply any of these fixes?"**

If yes, apply them **surgically**:
- Edit existing files (add missing sections, don't overwrite existing content)
- Create new files only where nothing exists
- Use the setup skill's templates and scripts as references for what to create
- Never overwrite existing CLAUDE.md content, settings, or rules — augment them
- After applying, suggest re-running `/readiness` to verify improvement
