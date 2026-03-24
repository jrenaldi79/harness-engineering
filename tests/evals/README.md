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

| Fixture | What It Tests |
|---|---|
| `setup-bare` | Empty directory — full greenfield Node/TS Express setup path (scaffolding, enforcement, hooks, docs). |
| `setup-existing-node` | Existing Express project — enhancement path that adds enforcement without destroying existing files. |

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
- **hooks_executable** — Git hooks that must have execute permissions
- **claude_md_sections** — Sections that must appear in generated CLAUDE.md
- **settings_has_allow_deny** — Verify .claude/settings.json has allow/deny permission lists
- **rules_have_globs_frontmatter** — Verify .claude/rules/*.md files have `globs:` in frontmatter
- **existing_files_preserved** — Files from the original fixture that must not be deleted
- **conversation_must_mention** — Terms the skill output must include

## Adding a New Fixture

1. Create a directory under `fixtures/` with the project files
2. Add a test case entry to the relevant eval config (`eval-config.json` or `setup-eval-config.json`)
3. Run `./tests/evals/run-evals.sh [--config <config>] <fixture-name>` to test

## Interpreting Results

Each run creates a timestamped directory under `results/` containing:

- `claude-output.json` — Raw Claude CLI JSON output
- `conversation.txt` — Extracted conversation text
- `grade.json` — Grader output with pass/fail per check
- `stderr.log` — Any stderr from the Claude run
- `duration.txt` — How long the run took
- `summary.json` — Aggregate pass/fail/error counts

For readiness evals: `readiness-report.md` (the generated report)
For setup evals: `CLAUDE.md`, `package.json`, `.claude/settings.json`, `.claude/rules/` (captured artifacts)
