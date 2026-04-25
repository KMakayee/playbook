#!/usr/bin/env bash
# Pipeline integrity evaluation for auto-issues.
# Usage: bash .claude/scripts/pipeline-eval.sh <issue-number> <timestamp>

set -euo pipefail

ISSUE="$1"
TIMESTAMP="$2"

VERDICT="PASS"
ISSUES=""

# 1. Log completeness — all 5 logs exist; every phase produces substantive Claude output
for phase in 1-research 2-plan 3-implement 4-update 5-commit; do
  f="tasks/logs/auto-issue-$ISSUE-$phase-$TIMESTAMP.log"
  if [ ! -f "$f" ]; then
    ISSUES="$ISSUES\nMISSING LOG: $f"
    VERDICT="FAIL"
  fi
done
# All 5 phases produce substantive Claude output
for phase in 1-research 2-plan 3-implement 4-update 5-commit; do
  f="tasks/logs/auto-issue-$ISSUE-$phase-$TIMESTAMP.log"
  if [ -f "$f" ] && [ "$(wc -l < "$f")" -lt 10 ]; then
    ISSUES="$ISSUES\nTINY LOG: $f ($(wc -l < "$f") lines)"
    [ "$VERDICT" = "PASS" ] && VERDICT="WARN"
  fi
done

# 2. Artifact substance — final artifacts need real content (20+ lines)
for f in tasks/research-issue-$ISSUE.md tasks/plan-issue-$ISSUE.md; do
  if [ ! -f "$f" ]; then
    ISSUES="$ISSUES\nMISSING ARTIFACT: $f"
    VERDICT="FAIL"
  elif [ "$(wc -l < "$f")" -lt 20 ]; then
    ISSUES="$ISSUES\nTHIN ARTIFACT: $f ($(wc -l < "$f") lines)"
    [ "$VERDICT" = "PASS" ] && VERDICT="WARN"
  fi
done

# 3. Append to eval index
INDEX="tasks/logs/pipeline-eval-index.md"
if [ ! -f "$INDEX" ]; then
  echo "| Issue | Timestamp | Verdict | Notes |" > "$INDEX"
  echo "|---|---|---|---|" >> "$INDEX"
fi
NOTES=$(echo -e "$ISSUES" | tr '\n' ' ' | sed 's/^ *//')
[ -z "$NOTES" ] && NOTES="—"
echo "| #$ISSUE | $TIMESTAMP | $VERDICT | $NOTES |" >> "$INDEX"

echo ""
echo "VERDICT: $VERDICT"
if [ -n "$ISSUES" ]; then echo -e "ISSUES:$ISSUES"; fi
