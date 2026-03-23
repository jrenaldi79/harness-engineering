#!/usr/bin/env bash
#
# Readiness Skill Eval Runner
#
# Copies each fixture to a temp directory (with a git repo init),
# runs `claude -p` with --plugin-dir pointing at the harness-engineering plugin,
# captures output, and passes results to the grader.
#
# Usage:
#   ./tests/evals/run-evals.sh                    # Run all test cases
#   ./tests/evals/run-evals.sh level-1-bare       # Run a single test case
#   ./tests/evals/run-evals.sh --dry-run          # Show what would run without executing
#
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

# Parse args
for arg in "$@"; do
  case $arg in
    --dry-run) DRY_RUN=true ;;
    *) FILTER="$arg" ;;
  esac
done

# Ensure dependencies
if ! command -v claude &>/dev/null; then
  echo -e "${RED}Error: 'claude' CLI not found. Install Claude Code first.${NC}"
  echo "  npm install -g @anthropic-ai/claude-code"
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo -e "${RED}Error: 'jq' not found. Install it first.${NC}"
  exit 1
fi

mkdir -p "$RESULTS_DIR"

# Read test cases from config — ONLY extract names/fixtures/descriptions, never expected values
PROMPT=$(jq -r '.prompt' "$CONFIG")
TIMEOUT=$(jq -r '.timeout_seconds' "$CONFIG")
TEST_CASES=$(jq -c '.test_cases[] | {name, fixture, description}' "$CONFIG")

TOTAL=0
PASSED=0
FAILED=0
ERRORS=0

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Harness Readiness Skill Eval Suite     ║${NC}"
echo -e "${BLUE}║   $(date '+%Y-%m-%d %H:%M:%S')                    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "Plugin dir:  $PLUGIN_DIR"
echo "Config:      $CONFIG"
echo "Results dir: $RESULTS_DIR"
echo ""

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

  # Initialize git repo (required for readiness skill)
  (cd "$tmp_dir" && git init -q && git add -A && git commit -q -m "Initial commit" 2>/dev/null) || true

  mkdir -p "$result_dir"

  if [ "$DRY_RUN" = true ]; then
    echo -e "  ${BLUE}[DRY RUN] Would execute:${NC}"
    echo "    cd $tmp_dir"
    echo "    claude --plugin-dir $PLUGIN_DIR -p \"...\" --allowedTools 'Bash,Read,Glob,Grep,Write,Agent' --permission-mode acceptEdits --output-format json"
    echo ""
    return 0
  fi

  echo -e "  ${BLUE}Running claude in $tmp_dir ...${NC}"

  # Run Claude with the readiness skill
  local start_time=$(date +%s)
  local claude_output=""
  local exit_code=0

  claude_output=$(
    cd "$tmp_dir" && \
    timeout "${TIMEOUT}s" claude \
      --plugin-dir "$PLUGIN_DIR" \
      -p "You are analyzing the project in the CURRENT WORKING DIRECTORY only. Do not look at files outside this directory. $PROMPT" \
      --allowedTools "Bash,Read,Glob,Grep,Write,Agent" \
      --permission-mode acceptEdits \
      --output-format json \
      2>"$result_dir/stderr.log"
  ) || exit_code=$?

  local end_time=$(date +%s)
  local duration=$((end_time - start_time))

  # Save raw output
  echo "$claude_output" > "$result_dir/claude-output.json"
  echo "$duration" > "$result_dir/duration.txt"

  if [ $exit_code -ne 0 ]; then
    echo -e "  ${RED}ERRROR: Claude exited with code $exit_code after ${duration}s${NC}"
    cat "$result_dir/stderr.log" 2>/dev/null
    ERRORS=$((ERRORS + 1))
    echo '{"status":"error","exit_code":'$exit_code',"duration":'$duration'}' > "$result_dir/result.json"
    return 0
  fi

  echo -e "  Completed in ${duration}s"

  # Extract the conversation result
  echo "$claude_output" | jq -r '.result // empty' > "$result_dir/conversation.txt" 2>/dev/null || true

  # Check if readiness report was created
  if [ -f "$tmp_dir/.claude/readiness-report.md" ]; then
    cp "$tmp_dir/.claude/readiness-report.md" "$result_dir/readiness-report.md"
    echo -e "  ${GREEN}✓ Report file created${NC}"
  else
    echo -e "  ${RED}✗ Report file NOT created${NC}"
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

# Run all test cases
while IFS= read -r tc; do
  run_test_case "$tc"
done <<< "$TEST_CASES"

# Summary
echo -e "${BLUE}━━━ Summary ━━━${NC}"
echo -e "  Total:  $TOTAL"
echo -e "  ${GREEN}Passed: $PASSED${NC}"
echo -e "  ${RED}Failed: $FAILED${NC}"
echo -e "  ${YELLOW}Errors: $ERRORS${NC}"
echo ""

if [ "$RESULTS_DIR" != "" ]; then
  echo "Results saved to: $RESULTS_DIR/$TIMESTAMP/"
fi

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
