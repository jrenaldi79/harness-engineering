# Skill Evals

End-to-end evaluation suites for the `/readiness` and `/setup` skills. Tests
each skill against fixture repos and validates the output.

## Prerequisites

- **Claude Code CLI** installed globally (`npm install -g @anthropic-ai/claude-code`)
- **jq** installed (`brew install jq` / `apt install jq`)
- Valid Anthropic API key in your environment

## Quick Start

```bash
# Run all readiness evals (default)
./tests/evals/run-evals.sh

# Run all setup evals
./tests/evals/run-evals.sh --config setup-eval-config.json

# Run a single test case
./tests/evals/run-evals.sh level-1-bare
./tests/evals/run-evals.sh --config setup-eval-config.json setup-bare

# Dry run (show commands without executing)
./tests/evals/run-evals.sh --dry-run
./tests/evals/run-evals.sh --config setup-eval-config.json --dry-run
```

**Run evals as Bash shell commands** so output streams live and you can monitor progress. Evals can take 5-15 minutes per fixture.

## How It Works

1. **Fixtures** (`fixtures/`) — Self-contained project directories representing test scenarios
2. **Runner** (`run-evals.sh`) — Copies each fixture to `/tmp`, inits a git repo, runs `claude -p` with `--plugin-dir` pointing at this plugin
3. **Graders** — Validate skill output against expected criteria in the eval config
4. **Results** (`results/`) — Timestamped output from each run (gitignored)

The runner accepts `--config <file>` to select which eval suite to run. Each config specifies its skill, grader, and test cases.

## Readiness Fixtures

| Fixture | Expected Level | What It Tests |
|---|---|---|
| `level-1-bare` | 1 (Bare) | Minimal project. Should detect missing everything, catch hardcoded secret. |
| `level-3-enforced` | 2-3 (Basic/Enforced) | Has linting, tests, hooks, CLAUDE.md. Missing secret scanning, TDD, workflow. |
| `level-5-autonomous` | 4-5 (Automated/Autonomous) | Full harness. Should pass nearly everything. |

## Setup Fixtures

| Fixture | Stack | What It Tests |
|---|---|---|
| `setup-bare` | Node/TS Express (new) | Full greenfield setup via fast path (scripts). |
| `setup-existing-node` | Node/TS Express (existing) | Enhancement without destroying existing files. |
| `setup-python` | Python FastAPI (new) | Adaptive path (Claude creates files, not scripts). Checks for Node leakage. |

## Eval Configs

### `eval-config.json` (readiness)

- **level.min/max** — Expected maturity level range
- **pillars.*.pass_min/pass_max** — Expected passing criteria per pillar
- **recommendations.must_mention** — Terms the recommendations MUST include
- **insights.must_detect** — Nuanced observations the skill should surface

### `setup-eval-config.json` (setup)

- **files_must_exist** — Files the skill must create (hard fail if missing)
- **files_should_exist** — Recommended files (soft check)
- **json_valid** — Files that must parse as valid JSON
- **hooks_executable** — Git hooks (checks both `.git/hooks/` and `.husky/`)
- **claude_md_sections** — Sections that must appear in generated CLAUDE.md
- **claude_md_must_mention / claude_md_must_not_mention** — Content checks on generated CLAUDE.md
- **settings_has_allow_deny** — Verify .claude/settings.json has allow/deny permission lists
- **rules_have_globs_frontmatter** — Verify .claude/rules/*.md files have `globs:` in frontmatter
- **auto_doc_pipeline** — Verify generate-docs scripts, pre-commit hook wiring, and AUTO markers
- **docs_index_generated** — Verify docs/ directory and docs/index.md exist
- **existing_files_preserved** — Files from the original fixture that must not be deleted

## Adding a New Fixture

1. Create a directory under `fixtures/` with the project files
2. Add a test case entry to the relevant eval config (`eval-config.json` or `setup-eval-config.json`)
3. Run `./tests/evals/run-evals.sh [--config <config>] <fixture-name>` to test

## Interpreting Results

Each run creates a timestamped directory under `results/` containing:

- `claude-output.json` — Raw Claude CLI JSON output
- `conversation.txt` — Extracted conversation text (final message only)
- `grade.json` — Grader output with pass/fail per check
- `stderr.log` — Any stderr from the Claude run
- `duration.txt` — How long the run took
- `summary.json` — Aggregate pass/fail/error counts

For readiness evals: `readiness-report.md` (the generated report)

For setup evals: Full project artifacts captured for debugging — `scripts/`, `docs/`, `src/`, `tests/`, `.claude/`, `.husky/`, `.git/hooks/`, `CLAUDE.md`, `package.json`, etc.
