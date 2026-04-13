#!/usr/bin/env bash
# Pipeline integrity evaluation for auto-issues.
# Usage: bash .claude/scripts/pipeline-eval.sh <issue-number> <timestamp>

set -euo pipefail

ISSUE="$1"
TIMESTAMP="$2"

VERDICT="PASS"
ISSUES=""

# 1. Log completeness — all 9 logs exist; non-Codex logs must have substance
for phase in 1-research 2-plan 3-review 4-apply-review 5-implement 6-code-review 7-apply-code-review 8-update 9-commit; do
  f="tasks/logs/auto-issue-$ISSUE-$phase-$TIMESTAMP.log"
  if [ ! -f "$f" ]; then
    ISSUES="$ISSUES\nMISSING LOG: $f"
    VERDICT="FAIL"
  fi
done
# Codex phases (1,3,6) produce near-empty stdout — skip line count for them
for phase in 2-plan 4-apply-review 5-implement 7-apply-code-review 8-update 9-commit; do
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

# 3. Codex outputs — confirm Codex produced real output (5+ lines)
for f in tasks/codex-issue-research-$ISSUE.tmp tasks/codex-issue-plan-review-$ISSUE.tmp \
         tasks/codex-issue-code-review-$ISSUE.tmp; do
  if [ ! -f "$f" ]; then
    ISSUES="$ISSUES\nMISSING CODEX OUTPUT: $f"
    VERDICT="FAIL"
  elif [ "$(wc -l < "$f")" -lt 5 ]; then
    ISSUES="$ISSUES\nTHIN CODEX OUTPUT: $f ($(wc -l < "$f") lines)"
    [ "$VERDICT" = "PASS" ] && VERDICT="WARN"
  fi
done

# 4. Review cycle completed (skip if plan already flagged missing above)
if [ -f tasks/plan-issue-$ISSUE.md ] && ! grep -q "## Review (Resolved)" tasks/plan-issue-$ISSUE.md; then
  ISSUES="$ISSUES\nPLAN REVIEW NOT RESOLVED"
  VERDICT="FAIL"
fi

# 5. Append to eval index
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
