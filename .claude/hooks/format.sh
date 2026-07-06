#!/bin/sh
# Stop hook: auto-format ONLY the files Claude touched this session, as recorded
# by collect-touched.sh (PostToolUse). Edits never reach CI unformatted, and the
# user's own uncommitted WIP is left alone (the old git-diff approach reformatted it).
#   backend  *.java      -> gradle spotlessApply -PspotlessIdeHook=<file> (formats just
#                           that file in place; module-wide fallback past the batch limit)
#   frontend anything    -> npx prettier --write --ignore-unknown <files>
#   ml       *.py        -> uv run ruff format + ruff check --fix <files>
# Known gap: files changed via Bash (sed -i, git apply, codegen) are not recorded.

command -v jq >/dev/null 2>&1 || { echo "format.sh: jq not found — auto-format skipped" >&2; exit 1; }

sid=$(jq -r '.session_id // "default"' | tr -cd 'A-Za-z0-9._-')
list="${TMPDIR:-/tmp}/claude-touched-${sid}.list"
[ -s "$list" ] || { rm -f "$list"; exit 0; }

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$root" || exit 0

tmp=$(mktemp -d) || exit 0
trap 'rm -rf "$tmp"' EXIT
sort -u "$list" >"$tmp/all"
rm -f "$list"

while IFS= read -r f; do
  [ -f "$f" ] || continue
  case "$f" in
    "$root"/backend/*.java) printf '%s\n' "$f" >>"$tmp/java" ;;
    "$root"/frontend/*)     printf '%s\n' "$f" >>"$tmp/fe" ;;
    "$root"/ml/*.py)        printf '%s\n' "$f" >>"$tmp/py" ;;
  esac
done <"$tmp/all"

# Per-file spotless keeps the user's WIP .java files untouched; past the limit a
# module-wide apply is cheaper than N gradle invocations.
JAVA_BATCH_LIMIT=10
if [ -s "$tmp/java" ]; then
  if [ "$(wc -l <"$tmp/java")" -le "$JAVA_BATCH_LIMIT" ]; then
    while IFS= read -r f; do
      (cd backend && ./gradlew -q spotlessApply -PspotlessIdeHook="$f" >/dev/null 2>&1) || true
    done <"$tmp/java"
  else
    (cd backend && ./gradlew -q spotlessApply >/dev/null 2>&1) || true
  fi
fi

if [ -s "$tmp/fe" ]; then
  (cd frontend && tr '\n' '\0' <"$tmp/fe" | xargs -0 npx prettier --write --ignore-unknown >/dev/null 2>&1) || true
fi

if [ -s "$tmp/py" ]; then
  (cd ml && tr '\n' '\0' <"$tmp/py" | xargs -0 uv run ruff format >/dev/null 2>&1) || true
  (cd ml && tr '\n' '\0' <"$tmp/py" | xargs -0 uv run ruff check --fix >/dev/null 2>&1) || true
fi

exit 0
