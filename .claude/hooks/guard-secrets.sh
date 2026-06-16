#!/bin/sh
# PreToolUse(Write|Edit|MultiEdit): block writes to secret / credential files.
# Exit 2 tells Claude Code to deny the tool call and surface the message below.
f=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)
case "$f" in
  *.env.example) exit 0 ;;
  *.pem | */dev-keys/* | *.env | *.env.*)
    echo "Blocked: '$f' looks like a secret/credentials file. Edit it manually." >&2
    exit 2
    ;;
esac
exit 0
