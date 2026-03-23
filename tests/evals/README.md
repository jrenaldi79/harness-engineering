# Readiness Skill Evals

End-to-end evaluation suite for the `/readiness` skill. Tests the skill against
fixture repos with known maturity levels and validates the output.

## Prerequisites

- **Claude Code CLI** installed globally (`npm install -g @anthropic-ai/claude-code`)
- **jq** installed (`brew install jq` / `apt install jq`)
- Valid Anthropic API key in your environment

## Quick Start

```bash
# Run all evals
./tests/evals/run-evals.sh

# Run a single test case
./tests/evals/run-evals.sh level-1-bare

# Dry run (show commands without executing)
./tests/evals/run-evals.sh --dry-run
```

## How It Works

1. **Fixtures** (`fixtures/`) — Self-contained project directories at known maturity levels
2. **Runner** (`run-evals.sh`) — Copies each fixture to `/tmp`, inits a git repo, runs `claude -p` with `--plugin-dir` pointing at this plugin
3. **Grader** (`grader.js`) — Validates the generated `.claude/readiness-report.md` against expected criteria in `eval-config.json`
4. **Results** (`results/`) — Timestamped output from each run (gitignored)

## Fixtures

| Fixture | Expected Level | What It Tests |
|---|---|---|
| `level-1-bare` | 1 (Bare) | Minimal project. Should detect missing everything, catch hardcoded secret. |
| `level-3-enforced` | 2-3 (Basic/Enforced) | Has linting, tests, hooks, CLAUDE.md. Missing secret scanning, TDD, workflow. |
| `level-5-autonomous` | 4-5 (Automated/Autonomous) | Full harness. Should pass nearly everything. |

## Eval Config

`eval-config.json` defines per-fixture expectations:

- **level.min/max** — Expected maturity level range
- **pillars.*.pass_min/pass_max** — Expected passing criteria per pillar
- **recommendations.must_mention** — Terms the recommendations MUST include
- **recommendations.must_not_mention** — Terms recommendations must NOT include (e.g., "run /setup")
- **insights.must_detect** — Nuanced observations the skill should surface

## Adding a New Fixture

1. Create a directory under `fixtures/` with the project files
2. Add a test case entry to `eval-config.json`
3. Run `./tests/evals/run-evals.sh <fixture-name>` to test

## Interpreting Results

Each run creates a timestamped directory under `results/` containing:

- `claude-output.json` — Raw Claude CLI JSON output
- `conversation.txt` — Extracted conversation text
- `readiness-report.md` — The generated report (if created)
- `grade.json` — Grader output with pass/fail per check
- `stderr.log` — Any stderr from the Claude run
- `duration.txt` — How long the run took
- `summary.json` — Aggregate pass/fail/error counts
