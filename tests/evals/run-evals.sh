#!/usr/bin/env bash
# Skill Eval Runner — runs claude -p against fixtures, grades output.
# Usage: ./run-evals.sh [--config X.json] [--dry-run] [test-case-name]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG="$SCRIPT_DIR/eval-config.json"
RESULTS_DIR="$SCRIPT_DIR/results"
GRADER="$SCRIPT_DIR/grader.js"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DRY_RUN=false
FILTER=""
CONFIG_OVERRIDE=""

# Parse args
while [ $# -gt 0 ]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --config) CONFIG_OVERRIDE="$2"; shift 2 ;;
    *) FILTER="$1"; shift ;;
  esac
done

# Allow --config to override the default eval-config.json
if [ -n "$CONFIG_OVERRIDE" ]; then
  if [[ "$CONFIG_OVERRIDE" = /* ]]; then
    CONFIG="$CONFIG_OVERRIDE"
  else
    CONFIG="$SCRIPT_DIR/$CONFIG_OVERRIDE"
  fi
fi

# Ensure dependencies
command -v claude &>/dev/null || { echo -e "${RED}Error: 'claude' CLI not found.${NC}"; exit 1; }
command -v jq &>/dev/null || { echo -e "${RED}Error: 'jq' not found.${NC}"; exit 1; }

# Validate marketplace.json via claude plugin validate
MARKETPLACE="$PLUGIN_DIR/.claude-plugin/marketplace.json"
if [ -f "$MARKETPLACE" ]; then
  echo -e "${BLUE}Validating marketplace.json schema...${NC}"
  if ! claude plugin validate "$PLUGIN_DIR" 2>&1; then
    echo -e "${RED}Error: claude plugin validate failed${NC}"; exit 1
  fi
  echo -e "${GREEN}  marketplace.json schema OK${NC}"
  echo ""
fi

mkdir -p "$RESULTS_DIR"

# Read test cases from config — ONLY extract names/fixtures/descriptions, never expected values
SKILL=$(jq -r '.skill' "$CONFIG")
PROMPT=$(jq -r '.prompt' "$CONFIG")
TIMEOUT=$(jq -r '.timeout_seconds' "$CONFIG")
CUSTOM_GRADER=$(jq -r '.grader // empty' "$CONFIG")
TEST_CASES=$(jq -c '.test_cases[] | {name, fixture, description, prompt, steps}' "$CONFIG")

# Resolve grader: use config-specified grader, or default to grader.js
if [ -n "$CUSTOM_GRADER" ]; then
  GRADER="$SCRIPT_DIR/$CUSTOM_GRADER"
fi

TOTAL=0
PASSED=0
FAILED=0
ERRORS=0

SKILL_LABEL=$(echo "$SKILL" | sed 's/.*/\u&/')
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
printf "${BLUE}║   Harness %-7s Skill Eval Suite     ║${NC}\n" "$SKILL_LABEL"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo "Plugin: $PLUGIN_DIR | Config: $(basename "$CONFIG")"
echo ""

# Run a single Claude invocation. Returns 0 on success, 1 on error (sets ERRORS).
run_claude_step() {
  local tmp_dir="$1"
  local prompt="$2"
  local result_dir="$3"
  local eval_settings="$4"
  local suffix="$5"  # e.g. "step-1" or "" for single-step

  local out_file="$result_dir/claude-output${suffix:+-$suffix}.json"
  local err_file="$result_dir/stderr${suffix:+-$suffix}.log"

  local start_time=$(date +%s)
  local claude_output=""
  local exit_code=0

  claude_output=$(
    cd "$tmp_dir" && \
    timeout "${TIMEOUT}s" claude \
      --plugin-dir "$PLUGIN_DIR" \
      -p "You are working on the project in the CURRENT WORKING DIRECTORY only. Do not look at files outside this directory. $prompt" \
      --allowedTools "Bash,Read,Glob,Grep,Write,Agent,Edit" \
      --permission-mode acceptEdits \
      --settings "$eval_settings" \
      --output-format json \
      2>"$err_file"
  ) || exit_code=$?

  local end_time=$(date +%s)
  local duration=$((end_time - start_time))
  echo "$claude_output" > "$out_file"

  if [ $exit_code -ne 0 ]; then
    echo -e "  ${RED}ERROR: Claude exited with code $exit_code after ${duration}s${NC}"
    cat "$err_file" 2>/dev/null
    ERRORS=$((ERRORS + 1))
    echo '{"status":"error","exit_code":'$exit_code',"duration":'$duration'}' > "$result_dir/result.json"
    return 1
  fi

  echo -e "  Completed in ${duration}s"
  return 0
}

run_test_case() {
  local tc="$1"
  local name=$(echo "$tc" | jq -r '.name')
  local fixture=$(echo "$tc" | jq -r '.fixture')
  local description=$(echo "$tc" | jq -r '.description')
  local fixture_path="$SCRIPT_DIR/$fixture"
  local result_dir="$RESULTS_DIR/$TIMESTAMP/$name"

  # Apply filter
  if [ -n "$FILTER" ] && [ "$name" != "$FILTER" ]; then
    return 0
  fi

  TOTAL=$((TOTAL + 1))

  echo -e "${YELLOW}━━━ Test Case: $name ━━━${NC}"
  echo "  $description"
  echo ""

  # Create temp directory with a real git repo
  local tmp_dir=$(mktemp -d)
  trap "rm -rf $tmp_dir" EXIT

  # Copy fixture into temp dir
  cp -r "$fixture_path/." "$tmp_dir/"

  # Seed .claude/settings.json BEFORE git init so it's part of the initial commit.
  mkdir -p "$tmp_dir/.claude" "$result_dir"
  if [ ! -f "$tmp_dir/.claude/settings.json" ]; then
    cat > "$tmp_dir/.claude/settings.json" <<'SEED'
{"permissions":{"allow":["Bash(*)","Read","Write","Edit","Glob","Grep","Agent"],"deny":["Bash(rm -rf /)","Bash(rm -rf ~)","Bash(git push --force*)","Bash(git push -f*)","Bash(git reset --hard*)","Bash(git clean -fd*)","Bash(npm publish*)"]}}
SEED
  fi
  (cd "$tmp_dir" && git init -q && git config commit.gpgsign false && git add -A && git commit -q -m "Initial commit") || true
  local eval_settings="$tmp_dir/.claude/settings.json"
  # Build list of steps: either from "steps" array or single prompt
  local steps_json=$(echo "$tc" | jq -c '.steps // empty')
  local tc_prompt=$(echo "$tc" | jq -r '.prompt // empty')

  if [ "$DRY_RUN" = true ]; then
    echo -e "  ${BLUE}[DRY RUN] Would execute:${NC}"
    echo "    cd $tmp_dir"
    echo "    claude --plugin-dir $PLUGIN_DIR -p \"...\" --permission-mode acceptEdits --output-format json"
    echo ""
    return 0
  fi

  # --- Run step(s) ---
  local total_duration=0

  if [ -n "$steps_json" ] && [ "$steps_json" != "null" ]; then
    # Multi-step test case
    local step_idx=0
    echo "$steps_json" | jq -c '.[]' | while IFS= read -r step; do
      step_idx=$((step_idx + 1))
      local step_prompt=$(echo "$step" | jq -r '.prompt')
      local step_label=$(echo "$step" | jq -r '.label // "Step '"$step_idx"'"')
      echo -e "  ${BLUE}[$step_label] Running claude in $tmp_dir ...${NC}"
      if ! run_claude_step "$tmp_dir" "$step_prompt" "$result_dir" "$eval_settings" "step-${step_idx}"; then
        return 0
      fi
    done
  else
    # Single-step test case
    local effective_prompt="${tc_prompt:-$PROMPT}"
    echo -e "  ${BLUE}Running claude in $tmp_dir ...${NC}"
    if ! run_claude_step "$tmp_dir" "$effective_prompt" "$result_dir" "$eval_settings" ""; then
      return 0
    fi
  fi

  # Capture artifacts (check for both setup and readiness outputs)
  if [ -f "$tmp_dir/.claude/readiness-report.md" ]; then
    cp "$tmp_dir/.claude/readiness-report.md" "$result_dir/readiness-report.md"
    echo -e "  ${GREEN}✓ Report file created${NC}"
  fi
  for f in CLAUDE.md package.json .prettierrc .gitignore .env.example; do
    [ -f "$tmp_dir/$f" ] && cp "$tmp_dir/$f" "$result_dir/" 2>/dev/null || true
  done
  for d in .claude/settings.json .claude/rules; do
    [ -e "$tmp_dir/$d" ] && { mkdir -p "$(dirname "$result_dir/$d")"; cp -r "$tmp_dir/$d" "$result_dir/$d" 2>/dev/null || true; }
  done
  if [ -f "$tmp_dir/.claude/setup-report.md" ]; then
    cp "$tmp_dir/.claude/setup-report.md" "$result_dir/" 2>/dev/null || true
  fi

  # Run grader
  echo -e "  ${BLUE}Grading...${NC}"
  local grade_result=""
  grade_result=$(node "$GRADER" \
    --config "$CONFIG" \
    --test-case "$name" \
    --result-dir "$result_dir" \
    --fixture-dir "$tmp_dir" \
    2>&1) || true

  echo "$grade_result" > "$result_dir/grade.json"

  # Parse grade
  local grade_pass=$(echo "$grade_result" | jq -r '.pass // false' 2>/dev/null)
  local grade_score=$(echo "$grade_result" | jq -r '.score // "?"' 2>/dev/null)
  local grade_details=$(echo "$grade_result" | jq -r '.details // "No details"' 2>/dev/null)

  if [ "$grade_pass" = "true" ]; then
    echo -e "  ${GREEN}✓ PASSED (score: $grade_score)${NC}"
    PASSED=$((PASSED + 1))
  else
    echo -e "  ${RED}✗ FAILED (score: $grade_score)${NC}"
    echo -e "  ${RED}  $grade_details${NC}"
    FAILED=$((FAILED + 1))
  fi

  # Show check details
  echo "$grade_result" | jq -r '.checks[]? | "  " + (if .pass then "✓" else "✗" end) + " " + .name' 2>/dev/null || true

  echo ""

  # Clean up temp dir
  rm -rf "$tmp_dir"
  trap - EXIT
}

# Run marketplace install test (only for readiness evals, not filtered to a specific test case)
INSTALL_TEST="$SCRIPT_DIR/test-marketplace-install.sh"
if [ "$SKILL" = "readiness" ] && [ -x "$INSTALL_TEST" ] && [ -z "$FILTER" -o "$FILTER" = "marketplace-install" ]; then
  TOTAL=$((TOTAL + 1))
  INSTALL_ARGS=""
  if [ "$DRY_RUN" = true ]; then
    INSTALL_ARGS="--dry-run"
  fi
  if bash "$INSTALL_TEST" $INSTALL_ARGS; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1))
  fi
  echo ""
fi

# Run all test cases
if [ "$FILTER" != "marketplace-install" ]; then
  while IFS= read -r tc; do
    run_test_case "$tc"
  done <<< "$TEST_CASES"
fi

# Summary
echo -e "${BLUE}━━━ Summary ━━━${NC}"
echo -e "  Total: $TOTAL | ${GREEN}Passed: $PASSED${NC} | ${RED}Failed: $FAILED${NC} | ${YELLOW}Errors: $ERRORS${NC}"
[ -n "$RESULTS_DIR" ] && echo "Results: $RESULTS_DIR/$TIMESTAMP/"
echo ""

# Write summary JSON
if [ "$DRY_RUN" = false ] && [ $TOTAL -gt 0 ]; then
  cat > "$RESULTS_DIR/$TIMESTAMP/summary.json" <<SUMEOF
{
  "timestamp": "$TIMESTAMP",
  "total": $TOTAL,
  "passed": $PASSED,
  "failed": $FAILED,
  "errors": $ERRORS,
  "pass_rate": "$(echo "scale=0; $PASSED * 100 / $TOTAL" | bc)%"
}
SUMEOF
fi

# Exit with failure if any test failed
if [ $FAILED -gt 0 ] || [ $ERRORS -gt 0 ]; then
  exit 1
fi
