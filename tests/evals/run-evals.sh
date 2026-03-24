#!/usr/bin/env bash
#
# Skill Eval Runner
#
# Copies each fixture to a temp directory (with a git repo init),
# runs `claude -p` with --plugin-dir pointing at the harness-engineering plugin,
# captures output, and passes results to the grader.
#
# Usage:
#   ./tests/evals/run-evals.sh                                      # Run all readiness test cases (default)
#   ./tests/evals/run-evals.sh --config setup-eval-config.json      # Run all setup test cases
#   ./tests/evals/run-evals.sh level-1-bare                         # Run a single test case
#   ./tests/evals/run-evals.sh --dry-run                            # Show what would run without executing
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

# Validate marketplace.json schema before running evals
MARKETPLACE="$PLUGIN_DIR/.claude-plugin/marketplace.json"
if [ -f "$MARKETPLACE" ]; then
  echo -e "${BLUE}Validating marketplace.json schema...${NC}"
  SCHEMA_ERRORS=""

  # owner must be an object, not a string
  OWNER_TYPE=$(jq -r '.owner | type' "$MARKETPLACE")
  if [ "$OWNER_TYPE" != "object" ]; then
    SCHEMA_ERRORS="${SCHEMA_ERRORS}\n  - owner must be an object (got $OWNER_TYPE)"
  fi

  # reject unrecognized root-level keys
  BAD_KEYS=$(jq -r 'keys[] | select(. != "$schema" and . != "name" and . != "owner" and . != "plugins" and . != "metadata")' "$MARKETPLACE" || true)
  if [ -n "$BAD_KEYS" ]; then
    SCHEMA_ERRORS="${SCHEMA_ERRORS}\n  - unrecognized root-level keys: $BAD_KEYS"
  fi

  # each plugin source must be an object, not a string
  STRING_SOURCES=$(jq -r '.plugins[]? | select(.source | type == "string") | .name' "$MARKETPLACE" || true)
  if [ -n "$STRING_SOURCES" ]; then
    SCHEMA_ERRORS="${SCHEMA_ERRORS}\n  - plugin source must be an object, not a string (in: $STRING_SOURCES)"
  fi

  if [ -n "$SCHEMA_ERRORS" ]; then
    echo -e "${RED}Error: marketplace.json has schema errors:${SCHEMA_ERRORS}${NC}"
    exit 1
  fi

  # Run claude plugin validate if available (authoritative check)
  if command -v claude &>/dev/null; then
    if ! claude plugin validate "$PLUGIN_DIR" 2>&1; then
      echo -e "${RED}Error: claude plugin validate failed${NC}"
      exit 1
    fi
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
TEST_CASES=$(jq -c '.test_cases[] | {name, fixture, description, prompt}' "$CONFIG")

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

  (cd "$tmp_dir" && git init -q && git add -A && git commit -q -m "Initial commit" 2>/dev/null) || true
  mkdir -p "$result_dir"
  local tc_prompt=$(echo "$tc" | jq -r '.prompt // empty')
  local effective_prompt="${tc_prompt:-$PROMPT}"

  if [ "$DRY_RUN" = true ]; then
    echo -e "  ${BLUE}[DRY RUN] Would execute:${NC}"
    echo "    cd $tmp_dir"
    echo "    claude --plugin-dir $PLUGIN_DIR -p \"...\" --allowedTools 'Bash,Read,Glob,Grep,Write,Agent,Edit' --permission-mode acceptEdits --output-format json"
    echo ""
    return 0
  fi

  echo -e "  ${BLUE}Running claude in $tmp_dir ...${NC}"
  local start_time=$(date +%s)
  local claude_output=""
  local exit_code=0

  claude_output=$(
    cd "$tmp_dir" && \
    timeout "${TIMEOUT}s" claude \
      --plugin-dir "$PLUGIN_DIR" \
      -p "You are working on the project in the CURRENT WORKING DIRECTORY only. Do not look at files outside this directory. $effective_prompt" \
      --allowedTools "Bash,Read,Glob,Grep,Write,Agent,Edit" \
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

  # Capture skill-specific artifacts
  if [ "$SKILL" = "readiness" ]; then
    if [ -f "$tmp_dir/.claude/readiness-report.md" ]; then
      cp "$tmp_dir/.claude/readiness-report.md" "$result_dir/readiness-report.md"
      echo -e "  ${GREEN}✓ Report file created${NC}"
    else
      echo -e "  ${RED}✗ Report file NOT created${NC}"
    fi
  elif [ "$SKILL" = "setup" ]; then
    for f in CLAUDE.md package.json .prettierrc .gitignore .env.example; do
      [ -f "$tmp_dir/$f" ] && cp "$tmp_dir/$f" "$result_dir/" 2>/dev/null || true
    done
    for d in .claude/settings.json .claude/rules; do
      [ -e "$tmp_dir/$d" ] && { mkdir -p "$(dirname "$result_dir/$d")"; cp -r "$tmp_dir/$d" "$result_dir/$d" 2>/dev/null || true; }
    done
    echo -e "  ${GREEN}✓ Setup artifacts captured${NC}"
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
