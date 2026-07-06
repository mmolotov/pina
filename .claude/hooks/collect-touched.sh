#!/bin/sh
# PostToolUse(Write|Edit|MultiEdit): append the edited file's path to a per-session
# list consumed by format.sh (Stop hook) — so auto-format touches exactly what
# Claude changed this session and never the user's unrelated WIP.
command -v jq >/dev/null 2>&1 || exit 0
input=$(cat)
f=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
[ -n "$f" ] || exit 0
sid=$(printf '%s' "$input" | jq -r '.session_id // "default"' | tr -cd 'A-Za-z0-9._-')

# Only track files inside the project (scratchpad/temp writes are not ours to format).
case "$f" in
  "${CLAUDE_PROJECT_DIR:-/nonexistent}"/*) ;;
  *) exit 0 ;;
esac

printf '%s\n' "$f" >> "${TMPDIR:-/tmp}/claude-touched-${sid}.list"
exit 0
