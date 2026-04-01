#!/usr/bin/env bash
# Stop hook: nudge Claude to verify work before finishing.
# Reads the hook input JSON from stdin and outputs a decision.

input=$(cat)
reason=$(echo "$input" | python3 -c "import sys,json; print(json.load(sys.stdin).get('stop_hook_reason',''))" 2>/dev/null || echo "")

# Always approve — the system message is the nudge
cat <<'EOF'
{"decision":"approve","systemMessage":"Reminder: before finishing, confirm (1) changes match the plan if one exists, (2) no unintended files were modified, (3) work was actually verified not just assumed correct."}
EOF
