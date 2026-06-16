#!/bin/sh
# Stop hook: auto-format code touched this turn so it never reaches CI unformatted.
#   Backend  -> ./gradlew spotlessApply        (only when *.java changed)
#   Frontend -> npm run format (prettier)       (only when frontend sources changed)
#   ML       -> uv run ruff format + --fix      (only when ml/*.py changed)
# Conditional on git-detected changes to avoid paying tool startup on every turn.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

changed=$(
  {
    git diff --name-only --diff-filter=ACM
    git ls-files --others --exclude-standard
  } 2>/dev/null
)
[ -z "$changed" ] && exit 0

if printf '%s\n' "$changed" | grep -q '^backend/.*\.java$'; then
  (cd backend && ./gradlew spotlessApply -q >/dev/null 2>&1) || true
fi

if printf '%s\n' "$changed" | grep -qE '^frontend/.*\.(ts|tsx|js|mjs|css|json|md)$'; then
  (cd frontend && npm run format >/dev/null 2>&1) || true
fi

if printf '%s\n' "$changed" | grep -qE '^ml/.*\.py$'; then
  (cd ml && uv run ruff format . >/dev/null 2>&1 && uv run ruff check --fix . >/dev/null 2>&1) || true
fi

exit 0
