#!/usr/bin/env bash
# Usage: bash scripts/create_issues.sh <owner>/<repo>
# Requires: gh (GitHub CLI, logged in), jq
set -euo pipefail
REPO="${1:?usage: create_issues.sh owner/repo}"
FILE="$(dirname "$0")/../issues.json"

echo "Creating labels..."
jq -r '.labels[]' "$FILE" | while read -r l; do
  gh label create "$l" --repo "$REPO" --force >/dev/null || true
done

echo "Creating milestones..."
jq -c '.milestones[]' "$FILE" | while read -r m; do
  t=$(echo "$m" | jq -r .title); d=$(echo "$m" | jq -r .description)
  gh api "repos/$REPO/milestones" -f title="$t" -f description="$d" >/dev/null 2>&1 || echo "  (milestone exists: $t)"
done

echo "Creating issues in order..."
jq -c '.issues[]' "$FILE" | while read -r i; do
  title=$(echo "$i" | jq -r .title)
  ms=$(echo "$i" | jq -r .milestone)
  labels=$(echo "$i" | jq -r '.labels | join(",")')
  body=$(echo "$i" | jq -r .body)
  gh issue create --repo "$REPO" --title "$title" --body "$body" --milestone "$ms" --label "$labels" >/dev/null
  echo "  created: $title"
  sleep 1
done
echo "Done."
