#!/usr/bin/env bash
#
# Marketplace Plugin Installation + Smoke Test
#
# Tests the full user journey:
#   1. Add the marketplace via `claude plugin marketplace add`
#   2. Install the plugin via `claude plugin install`
#   3. Run the /readiness skill against a fixture project
#   4. Verify a readiness report is produced
#
# Usage:
#   ./tests/evals/test-marketplace-install.sh              # Run the test
#   ./tests/evals/test-marketplace-install.sh --dry-run     # Show what would run
#
# Prerequisites:
#   - Claude Code CLI installed
#   - Plugin must be pushed to GitHub (tests against the remote repo)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FIXTURE_DIR="$SCRIPT_DIR/fixtures/level-1-bare"
RESULTS_DIR="$SCRIPT_DIR/results"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REPO="jrenaldi79/harness-engineering"
PLUGIN_NAME="harness-engineering"
SKILL_TIMEOUT=300

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DRY_RUN=false
for arg in "$@"; do
  case $arg in
    --dry-run) DRY_RUN=true ;;
  esac
done

# Ensure dependencies
if ! command -v claude &>/dev/null; then
  echo -e "${RED}Error: 'claude' CLI not found. Install Claude Code first.${NC}"
  exit 1
fi

echo -e "${BLUE}━━━ Marketplace Install + Smoke Test ━━━${NC}"
echo "  Repo:    $REPO"
echo "  Plugin:  $PLUGIN_NAME"
echo "  Fixture: level-1-bare"
echo ""

RESULT_DIR="$RESULTS_DIR/$TIMESTAMP/marketplace-install"
mkdir -p "$RESULT_DIR"

# Create a clean temp directory with the fixture project
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

cp -r "$FIXTURE_DIR/." "$TMP_DIR/"
(cd "$TMP_DIR" && git init -q && git add -A && git commit -q -m "Initial commit" 2>/dev/null) || true

# Ensure Bash commands are auto-approved (required for root/sandbox environments)
mkdir -p "$TMP_DIR/.claude"
if [ ! -f "$TMP_DIR/.claude/settings.json" ]; then
  echo '{"permissions":{"allow":["Bash(*)"]}}' > "$TMP_DIR/.claude/settings.json"
fi

if [ "$DRY_RUN" = true ]; then
  echo -e "  ${BLUE}[DRY RUN] Step 1 — Add marketplace:${NC}"
  echo "    claude plugin marketplace add $REPO --scope local"
  echo ""
  echo -e "  ${BLUE}[DRY RUN] Step 2 — Install plugin:${NC}"
  echo "    claude plugin install $PLUGIN_NAME --scope local"
  echo ""
  echo -e "  ${BLUE}[DRY RUN] Step 3 — Run /readiness skill:${NC}"
  echo "    cd $TMP_DIR"
  echo "    claude -p \"Run a readiness analysis...\" --output-format json"
  echo ""
  echo -e "  ${BLUE}[DRY RUN] Step 4 — Verify report:${NC}"
  echo "    Check .claude/readiness-report.md exists and contains expected sections"
  echo ""
  exit 0
fi

PASS_COUNT=0
FAIL_COUNT=0

pass() { echo -e "  ${GREEN}✓ $1${NC}"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo -e "  ${RED}✗ $1${NC}"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

# ─── Step 1: Add the marketplace ───
echo -e "${YELLOW}Step 1: Add marketplace${NC}"
EXIT_CODE=0

ADD_OUTPUT=$(
  cd "$TMP_DIR" && \
  claude plugin marketplace add "$REPO" --scope local \
    2>"$RESULT_DIR/marketplace-add-stderr.log"
) || EXIT_CODE=$?

echo "$ADD_OUTPUT" > "$RESULT_DIR/marketplace-add-output.txt"

if [ $EXIT_CODE -ne 0 ]; then
  fail "marketplace add exited with code $EXIT_CODE"
  cat "$RESULT_DIR/marketplace-add-stderr.log" 2>/dev/null | sed 's/^/    /'
  echo ""
  echo -e "${RED}━━━ Result: FAIL (cannot continue without marketplace) ━━━${NC}"
  exit 1
fi

pass "Marketplace added successfully"

# Verify marketplace is listed
LIST_OUTPUT=$(cd "$TMP_DIR" && claude plugin marketplace list 2>/dev/null) || true
echo "$LIST_OUTPUT" > "$RESULT_DIR/marketplace-list-output.txt"

if echo "$LIST_OUTPUT" | grep -qi "$PLUGIN_NAME\|$REPO"; then
  pass "Marketplace appears in listing"
else
  fail "Marketplace not found in listing"
fi
echo ""

# ─── Step 2: Install the plugin ───
echo -e "${YELLOW}Step 2: Install plugin${NC}"
EXIT_CODE=0

INSTALL_OUTPUT=$(
  cd "$TMP_DIR" && \
  claude plugin install "$PLUGIN_NAME" --scope local \
    2>"$RESULT_DIR/install-stderr.log"
) || EXIT_CODE=$?

echo "$INSTALL_OUTPUT" > "$RESULT_DIR/install-output.txt"

if [ $EXIT_CODE -ne 0 ]; then
  fail "Plugin install exited with code $EXIT_CODE"
  cat "$RESULT_DIR/install-stderr.log" 2>/dev/null | sed 's/^/    /'
  echo ""
  echo -e "${RED}━━━ Result: FAIL (cannot continue without plugin) ━━━${NC}"
  exit 1
fi

pass "Plugin installed successfully"

# Verify plugin is listed
PLUGIN_LIST=$(cd "$TMP_DIR" && claude plugin list 2>/dev/null) || true
echo "$PLUGIN_LIST" > "$RESULT_DIR/plugin-list-output.txt"

if echo "$PLUGIN_LIST" | grep -qi "$PLUGIN_NAME"; then
  pass "Plugin appears in installed list"
else
  fail "Plugin not found in installed list"
fi
echo ""

# ─── Step 3: Run /readiness skill via the installed plugin ───
echo -e "${YELLOW}Step 3: Run /readiness skill via installed plugin${NC}"
EXIT_CODE=0

SKILL_OUTPUT=$(
  cd "$TMP_DIR" && \
  timeout "${SKILL_TIMEOUT}s" claude \
    -p "/readiness" \
    --allowedTools "Bash,Read,Glob,Grep,Write,Agent" \
    --permission-mode acceptEdits \
    --settings "$TMP_DIR/.claude/settings.json" \
    --output-format json \
    2>"$RESULT_DIR/skill-stderr.log"
) || EXIT_CODE=$?

echo "$SKILL_OUTPUT" > "$RESULT_DIR/skill-output.json"
SKILL_RESULT=$(echo "$SKILL_OUTPUT" | jq -r '.result // empty' 2>/dev/null || echo "$SKILL_OUTPUT")
echo "$SKILL_RESULT" > "$RESULT_DIR/skill-result.txt"

if [ $EXIT_CODE -ne 0 ]; then
  fail "Readiness skill exited with code $EXIT_CODE"
  cat "$RESULT_DIR/skill-stderr.log" 2>/dev/null | head -5 | sed 's/^/    /'
else
  pass "Readiness skill completed without errors"
fi
echo ""

# ─── Step 4: Verify the readiness report ───
echo -e "${YELLOW}Step 4: Verify readiness report${NC}"

REPORT_PATH="$TMP_DIR/.claude/readiness-report.md"

if [ -f "$REPORT_PATH" ]; then
  pass "Report file created at .claude/readiness-report.md"
  cp "$REPORT_PATH" "$RESULT_DIR/readiness-report.md"

  REPORT_CONTENT=$(cat "$REPORT_PATH")

  # Check for YAML frontmatter
  if echo "$REPORT_CONTENT" | head -1 | grep -q "^---$"; then
    pass "Report has YAML frontmatter"
  else
    fail "Report missing YAML frontmatter"
  fi

  # Check for pillar scores section
  if echo "$REPORT_CONTENT" | grep -qi "pillar scores"; then
    pass "Report has Pillar Scores section"
  else
    fail "Report missing Pillar Scores section"
  fi

  # Check for level assignment
  if echo "$REPORT_CONTENT" | grep -qi "level"; then
    pass "Report includes level assignment"
  else
    fail "Report missing level assignment"
  fi

  # Check for progress bars (visual formatting)
  if echo "$REPORT_CONTENT" | grep -q "[█░]"; then
    pass "Report includes progress bars"
  else
    fail "Report missing progress bars"
  fi
else
  fail "Report file NOT created"
fi

echo ""

# ─── Summary ───
TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo -e "${BLUE}━━━ Summary ━━━${NC}"
echo -e "  Checks: $TOTAL"
echo -e "  ${GREEN}Passed: $PASS_COUNT${NC}"
echo -e "  ${RED}Failed: $FAIL_COUNT${NC}"
echo "  Results: $RESULT_DIR/"
echo ""

if [ $FAIL_COUNT -gt 0 ]; then
  echo -e "${RED}━━━ Result: FAIL ━━━${NC}"
  exit 1
fi

echo -e "${GREEN}━━━ Result: PASS ━━━${NC}"
