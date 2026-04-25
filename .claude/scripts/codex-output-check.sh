#!/usr/bin/env bash
# Verify a Codex tmp output exists and has substance.
# Usage: bash .claude/scripts/codex-output-check.sh <path> [<min-lines>]
# Default min-lines: 5 (matches pipeline-eval.sh:41-50 precedent for Codex outputs).

set -euo pipefail

FILE="${1:?usage: codex-output-check.sh <path> [<min-lines>]}"
MIN_LINES="${2:-5}"

if [ ! -f "$FILE" ]; then
  echo "FAIL: missing $FILE"
  exit 1
fi

LINES=$(wc -l < "$FILE" | tr -d ' ')
if [ "$LINES" -lt "$MIN_LINES" ]; then
  echo "FAIL: $FILE has $LINES lines (expected ≥ $MIN_LINES)"
  exit 1
fi

echo "OK: $FILE ($LINES lines)"
