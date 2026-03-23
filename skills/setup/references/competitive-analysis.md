# Competitive Analysis: Harness vs. Industry Approaches

Reference for evaluating and improving the harness system against published approaches for AI-assisted development.

---

## 1. Akshay Kothari (Notion COO) — Claude Code Setup

**Source:** [LinkedIn post](https://www.linkedin.com/posts/akothari_my-claude-code-setup-after-extensive-experimentation-activity-7336065911014084610-HEdh/) on Claude Code development practices

### Concept Mapping

| Their Concept | Our Equivalent | Status |
|---|---|---|
| CLAUDE.md with project context | `project-claude.md` + `global-claude.md` templates | Match |
| Pre-commit hooks | `install-enforcement.js` + hook scripts | Match |
| lint-staged integration | Included in enforcement scripts | Match |
| File size limits | `check-file-sizes.js` (300-line limit) | Match |
| Secret detection | `check-secrets.js` | Match |
| Code style in CLAUDE.md | `rules/code-quality.md`, `rules/typescript.md` | Match (path-scoped) |
| TDD enforcement | `rules/tdd.md` | Stronger |
| Path-scoped rules | Not in their setup | We're stronger |
| Auto-generated docs | Not in their setup | We're stronger |
| Doc drift detection | Not in their setup | We're stronger |

**Summary:** We match or exceed. Our advantages: path-scoped `.claude/rules/`, auto-generated documentation, doc drift detection.

---

## 2. Factory.ai — "Using Linters to Direct Agents"

**Source:** [Using Linters to Direct Agents](https://factory.ai/news/using-linters-to-direct-agents)
**Author:** Alvin Sng (September 2025)

### Their Thesis
"Agents write the code; linters write the law." Advisory guidance (AGENTS.md) explains the "why"; linting mechanically enforces the "how."

### Our Thesis
Mechanical enforcement > path-scoped rules > CLAUDE.md prose. Git hooks block violations; rules provide context; CLAUDE.md sets global principles.

**Verdict:** Same conclusion, arrived at independently. Their "linting = the how, AGENTS.md = the why" maps to our "git hooks = mechanical enforcement, .claude/rules/ = advisory context, CLAUDE.md = global principles."

### Concept Mapping

| Factory Concept | Our Equivalent | Status |
|---|---|---|
| "Lint green" = definition of done | Pre-commit hook blocks commits if check fails | **Match** |
| AGENTS.md explains the "why" | CLAUDE.md + `.claude/rules/` | **Match** (split across two tiers) |
| Linting = the "how" and guarantee | Git hooks (`check-file-sizes.js`, `check-secrets.js`, `lint-staged`) | **Match** |
| Grep-ability (named exports, absolute imports) | `rules/typescript.md` | **Partial** — advisory only |
| Glob-ability (deterministic file placement) | `init-project.js` scaffolds structure | **Partial** — scaffold but don't enforce |
| Architectural boundaries (no cross-layer imports) | Not implemented | **Gap** |
| Security (block secrets, no eval) | `check-secrets.js` | **Match** on secrets; **Partial** on unsafe functions |
| Testability (colocated tests, no network in tests) | `rules/tdd.md`, `rules/testing.md` | **Partial** — process, not mechanical |
| Observability (structured logging, telemetry) | `global-claude.md` Logging section | **Advisory only** |
| Documentation signals (docstrings, TSDoc) | `project-claude.md` code review checklist | **Advisory only** |
| File size limits | `check-file-sizes.js` (300-line limit) | **Match** |
| Complexity constraints | `rules/code-quality.md` | **Advisory only** |
| Lint development cycle (observe → codify → surface → remediate → prevent) | Not formalized | **Gap** |
| Linters as migration engines | Not implemented | **Gap** |

### Factory's Seven Lint Rule Categories

1. **Grep-ability** — Named exports, absolute imports, consistent error types
2. **Glob-ability** — Predictable file structures for agent placement
3. **Architectural boundaries** — Cross-layer import prevention, module allowlists
4. **Security & privacy** — Block secrets, require validation, prohibit unsafe functions
5. **Testability & coverage** — Colocated tests, no network in unit tests
6. **Observability** — Structured logging, error metadata, telemetry naming
7. **Documentation signals** — Module docstrings, TSDoc, ADR links

### Where We're Stronger

1. **Path-scoped context injection** — `.claude/rules/` with globs. Factory has flat AGENTS.md + global linting. We have tiered context per file pattern.
2. **Auto-generated documentation** — `generate-docs.js` with AUTO markers. Factory doesn't address doc-code sync.
3. **Drift detection** — `validate-docs.js` warns when code diverges from docs.
4. **TDD as first-class process** — Dedicated 60-line rule file. Factory mentions testability but not test-first methodology.
5. **SHA-based test caching** — Smart pre-push caching.

### Where Factory Is Stronger

1. **AST-aware linting** — Beyond regex to AST/type-aware rules (import graphs, cross-layer boundaries). Our enforcement scripts are regex/line-count based.
2. **Grep-ability as a category** — Named exports, absolute imports, deterministic file placement mechanically enforced.
3. **Architectural boundary enforcement** — Module boundaries, import direction validation. We have nothing here.
4. **Lint development lifecycle** — 5-step cycle (observe → codify → surface → remediate → prevent) as a formalized process.
5. **Linters as migration engines** — Using lint rules + autofixes for codebase-wide migrations.
6. **Observability enforcement** — Mandatory structured logging, error metadata, telemetry naming.

### Key Takeaway
The gap isn't philosophical — we agree on the approach. The gap is **sophistication of the mechanical layer**. Factory invests in AST-level custom lint rules; we're at the regex/script level. Our advantage is in the advisory layer (path-scoped rules, doc automation, TDD process).

---

## Identified Gaps — Honest Assessment

Not everything Factory does is worth copying. Some of their categories are genuine improvements for us; others are overkill for a harness template or look good on paper but don't prevent real problems.

### Worth Doing

1. **Mechanical complexity enforcement (function length, console.log bans)**
   - **Why it's real:** Long functions are the #1 thing agents produce that causes problems — they dump 200-line functions that are impossible to debug or test. A simple ESLint rule (`max-lines-per-function: 50`) catches this instantly and forces the agent to decompose. `console.log` bans (`no-console`) prevent debug noise leaking to production. Both are standard ESLint rules — zero custom work.
   - **Why it's not theater:** We already tell agents "keep functions under 50 lines" in `rules/code-quality.md`. If it's worth saying, it's worth enforcing. The advisory version is the theater; the ESLint rule is the fix.

2. **Named exports over default exports**
   - **Why it's real:** Default exports break tooling. You can't reliably `grep` for where something is used because the consumer picks any name they want. Named exports mean `export function createUser` is always findable as `createUser` everywhere. This matters for agents doing multi-file refactors — they can search/replace with confidence.
   - **Why it's not theater:** This is a one-line ESLint rule (`import/no-default-export`). The cost is trivial and the payoff compounds with every file the agent touches.

3. **Test colocation check**
   - **Why it's real:** When an agent creates `src/users/service.ts` but forgets `src/users/service.test.ts`, our TDD rule says "write tests first" but nothing verifies it happened. A simple script (like `check-file-sizes.js`) that walks `src/` and flags any `.ts` file without a matching `.test.ts` catches this at commit time.
   - **Why it's not theater:** Our whole harness philosophy is TDD. If we don't mechanically verify tests exist, the TDD rule is aspirational, not enforced.

### Maybe Worth Doing (Depends on Project)

4. **Absolute import paths**
   - **The case for:** `../../../utils/auth` is fragile — moving a file breaks all its importers. `@app/utils/auth` works from anywhere. Agents are bad at counting `../` levels.
   - **The case against:** Requires `tsconfig.json` path aliases configured per-project. Our harness is a template — we'd be imposing a config choice. Better as a recommendation in `rules/typescript.md` than a lint rule in the template.
   - **Verdict:** Upgrade the advisory rule to explain *why*, but don't enforce mechanically in the template.

5. **Lint development lifecycle documentation**
   - **The case for:** Factory's 5-step cycle (observe drift → codify rule → surface violations → fix → prevent) is a good mental model for how to evolve the harness over time.
   - **The case against:** This is a process document, not enforcement. Adding a "how to add new rules" section is useful; pretending it's a gap in our system overstates it.
   - **Verdict:** We already have the "Adding New Rules" section in CLAUDE.md from the previous work. Could expand it slightly but it's not a gap — it's polish.

### Not Worth Doing (Theater or Overkill for a Template)

6. **Architectural boundary enforcement (cross-layer import rules)**
   - **Why it sounds good:** "Prevent services from importing controllers" sounds rigorous.
   - **Why it's theater for us:** Architectural boundaries are project-specific. A billing app's layers are different from a CLI tool's. Writing generic boundary rules in a template would be wrong for most projects. This belongs in the team's custom ESLint config, not in a harness template.

7. **Observability enforcement (mandatory structured logging)**
   - **Why it sounds good:** "Require all logs to use structured format" sounds professional.
   - **Why it's theater for us:** Logging patterns depend entirely on the project's logging library (winston, pino, console). Enforcing a specific pattern in a template either picks the wrong library or is so generic it's useless. Our advisory mention in `global-claude.md` is the right level.

8. **Documentation signals (mandatory TSDoc, module docstrings)**
   - **Why it sounds good:** "Require JSDoc on all public APIs" sounds thorough.
   - **Why it's theater:** Forced docstrings produce `/** Creates a user */` above `function createUser()` — noise that makes the file longer without helping anyone. Good documentation is a judgment call, not a lint rule. Our `generate-docs.js` approach (auto-generate structural docs, let humans write conceptual docs) is better than mandatory boilerplate.

9. **Linters as migration engines**
   - **Why it sounds good:** "Use lint rules to drive React class → hooks migration" is clever.
   - **Why it's theater for us:** This is a technique for mature teams managing large codebases over time. It's not a harness feature — it's an operational pattern. Documenting it would be "here's a cool idea" not "here's something our template does."

---

## Implemented Improvements

These gaps have been addressed:

| Action | Status |
|---|---|
| `max-lines-per-function: 50` + `no-console` in ESLint config template | Done — `eslint-base.js` |
| `import/no-default-export` in ESLint config template | Done — `eslint-base.js` |
| Test colocation check script | Done — `check-test-colocation.js` |
| Absolute imports explanation in `rules/typescript.md` | Done — expanded with rationale |
