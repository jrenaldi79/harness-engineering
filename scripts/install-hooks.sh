#!/usr/bin/env bash

# Install git hooks for harness-engineering repo.
# Copies hooks from scripts/hooks/ into .git/hooks/ and makes them executable.
#
# Usage: bash scripts/install-hooks.sh

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_SRC="$REPO_ROOT/scripts/hooks"
HOOKS_DST="$REPO_ROOT/.git/hooks"

for hook in pre-commit pre-push; do
  if [ -f "$HOOKS_SRC/$hook" ]; then
    cp "$HOOKS_SRC/$hook" "$HOOKS_DST/$hook"
    chmod +x "$HOOKS_DST/$hook"
    echo "Installed $hook hook."
  fi
done

echo "Done. Git hooks are active."
