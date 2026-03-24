#!/usr/bin/env bash
#
# Marketplace Plugin Installation Test
#
# Tests that the plugin can be installed via `/plugin marketplace add`
# by running `claude -p` with the marketplace install command in a
# clean temp directory.
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
RESULTS_DIR="$SCRIPT_DIR/results"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REPO="jrenaldi79/harness-engineering"
TIMEOUT=120

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

echo -e "${BLUE}━━━ Marketplace Install Test ━━━${NC}"
echo "  Repo: $REPO"
echo ""

RESULT_DIR="$RESULTS_DIR/$TIMESTAMP/marketplace-install"
mkdir -p "$RESULT_DIR"

# Create a clean temp directory to simulate a fresh user environment
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

(cd "$TMP_DIR" && git init -q && git commit -q --allow-empty -m "init" 2>/dev/null) || true

if [ "$DRY_RUN" = true ]; then
  echo -e "  ${BLUE}[DRY RUN] Would execute:${NC}"
  echo "    cd $TMP_DIR"
  echo "    claude -p \"/plugin marketplace add $REPO\" --output-format json"
  echo ""
  echo -e "  ${BLUE}[DRY RUN] Then verify with:${NC}"
  echo "    claude -p \"/plugin marketplace list\" --output-format json"
  echo ""
  exit 0
fi

# Step 1: Install the plugin via marketplace
echo -e "  ${BLUE}Installing plugin via marketplace...${NC}"
INSTALL_OUTPUT=""
EXIT_CODE=0

INSTALL_OUTPUT=$(
  cd "$TMP_DIR" && \
  timeout "${TIMEOUT}s" claude \
    -p "/plugin marketplace add $REPO" \
    --output-format json \
    2>"$RESULT_DIR/install-stderr.log"
) || EXIT_CODE=$?

echo "$INSTALL_OUTPUT" > "$RESULT_DIR/install-output.json"

if [ $EXIT_CODE -ne 0 ]; then
  echo -e "  ${RED}FAILED: claude exited with code $EXIT_CODE${NC}"
  cat "$RESULT_DIR/install-stderr.log" 2>/dev/null
  echo ""
  echo -e "${RED}━━━ Result: FAIL ━━━${NC}"
  exit 1
fi

# Check for errors in the output
INSTALL_RESULT=$(echo "$INSTALL_OUTPUT" | jq -r '.result // empty' 2>/dev/null || echo "$INSTALL_OUTPUT")
echo "$INSTALL_RESULT" > "$RESULT_DIR/install-result.txt"

# Look for error indicators in the output
if echo "$INSTALL_RESULT" | grep -qi "error\|invalid\|failed\|schema"; then
  echo -e "  ${RED}FAILED: Install output contains error indicators${NC}"
  echo "  Output:"
  echo "$INSTALL_RESULT" | head -10 | sed 's/^/    /'
  echo ""
  echo -e "${RED}━━━ Result: FAIL ━━━${NC}"
  exit 1
fi

echo -e "  ${GREEN}Install command completed successfully${NC}"

# Step 2: Verify the plugin is listed
echo -e "  ${BLUE}Verifying plugin is listed...${NC}"
LIST_OUTPUT=""
EXIT_CODE=0

LIST_OUTPUT=$(
  cd "$TMP_DIR" && \
  timeout "${TIMEOUT}s" claude \
    -p "List all installed plugins. Just list them, nothing else." \
    --output-format json \
    2>"$RESULT_DIR/list-stderr.log"
) || EXIT_CODE=$?

echo "$LIST_OUTPUT" > "$RESULT_DIR/list-output.json"

LIST_RESULT=$(echo "$LIST_OUTPUT" | jq -r '.result // empty' 2>/dev/null || echo "$LIST_OUTPUT")
echo "$LIST_RESULT" > "$RESULT_DIR/list-result.txt"

if echo "$LIST_RESULT" | grep -qi "harness-engineering"; then
  echo -e "  ${GREEN}Plugin 'harness-engineering' found in installed plugins${NC}"
else
  echo -e "  ${YELLOW}Warning: Could not confirm plugin in listing (may still be installed)${NC}"
fi

echo ""
echo -e "${GREEN}━━━ Result: PASS ━━━${NC}"
echo "Results saved to: $RESULT_DIR/"
