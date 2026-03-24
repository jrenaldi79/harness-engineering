#!/usr/bin/env bash

# Release script — bumps plugin.json version, validates changelog, commits, and tags.
#
# Usage:
#   bash scripts/release.sh 1.2.0             # Create release
#   bash scripts/release.sh 1.2.0 --dry-run   # Preview without changes
#   bash scripts/release.sh 1.2.0 --push      # Create release and push tag

set -euo pipefail

VERSION="${1:-}"
DRY_RUN=false
PUSH=false

for arg in "$@"; do
  case $arg in
    --dry-run) DRY_RUN=true ;;
    --push) PUSH=true ;;
  esac
done

# ─── Validation ───

if [ -z "$VERSION" ] || [[ "$VERSION" == --* ]]; then
  echo "Usage: bash scripts/release.sh <version> [--dry-run] [--push]"
  echo "  Example: bash scripts/release.sh 1.2.0"
  exit 1
fi

if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: '$VERSION' is not valid semver (expected X.Y.Z)"
  exit 1
fi

PLUGIN_JSON=".claude-plugin/plugin.json"
if [ ! -f "$PLUGIN_JSON" ]; then
  echo "Error: $PLUGIN_JSON not found"
  exit 1
fi

CURRENT=$(grep -o '"version": *"[^"]*"' "$PLUGIN_JSON" | grep -o '[0-9][0-9.]*')
if [ -z "$CURRENT" ]; then
  echo "Error: Could not read current version from $PLUGIN_JSON"
  exit 1
fi

# Compare versions (new must be higher than current)
version_gt() {
  local IFS=.
  local i a=($1) b=($2)
  for ((i=0; i<3; i++)); do
    if (( ${a[i]:-0} > ${b[i]:-0} )); then return 0; fi
    if (( ${a[i]:-0} < ${b[i]:-0} )); then return 1; fi
  done
  return 1
}

if ! version_gt "$VERSION" "$CURRENT"; then
  echo "Error: New version ($VERSION) must be higher than current ($CURRENT)"
  exit 1
fi

# Check CHANGELOG.md has an entry for this version
if ! grep -q "\[$VERSION\]" CHANGELOG.md 2>/dev/null; then
  echo "Error: No changelog entry found for [$VERSION] in CHANGELOG.md"
  echo "Add a '## [$VERSION] - YYYY-MM-DD' section before releasing."
  exit 1
fi

# Check working tree is clean
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "Error: Working tree has uncommitted changes. Commit or stash first."
  exit 1
fi

# ─── Dry run ───

if [ "$DRY_RUN" = true ]; then
  echo "[dry-run] Would release v$VERSION"
  echo "[dry-run]   Current version: $CURRENT"
  echo "[dry-run]   Bump $PLUGIN_JSON: $CURRENT -> $VERSION"
  echo "[dry-run]   Create commit: \"Release v$VERSION\""
  echo "[dry-run]   Create tag: v$VERSION"
  if [ "$PUSH" = true ]; then
    echo "[dry-run]   Push tag to origin"
  fi
  exit 0
fi

# ─── Execute ───

echo "Releasing v$VERSION (current: $CURRENT)"

# Bump version in plugin.json
sed -i "s/\"version\": *\"$CURRENT\"/\"version\": \"$VERSION\"/" "$PLUGIN_JSON"
echo "  Bumped $PLUGIN_JSON: $CURRENT -> $VERSION"

# Commit and tag
git add "$PLUGIN_JSON"
git commit -q -m "Release v$VERSION"
git tag "v$VERSION"
echo "  Created commit and tag v$VERSION"

# Push if requested
if [ "$PUSH" = true ]; then
  git push origin main
  git push origin "v$VERSION"
  echo "  Pushed to origin"
fi

echo ""
echo "Release v$VERSION complete."
if [ "$PUSH" = false ]; then
  echo "Run 'git push origin main && git push origin v$VERSION' to publish."
fi
