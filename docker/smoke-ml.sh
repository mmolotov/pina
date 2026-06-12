#!/usr/bin/env bash
# End-to-end ML stack smoke: boots postgres + ml + backend via compose,
# uploads a photo through the API, and waits until the asynchronous ML
# analysis lands in the database (backend -> gRPC -> ML -> pgvector).
#
# Usage:
#   docker/smoke-ml.sh [--down]
#
# PINA_ML_PROFILE selects the runtime profile (default: cpu-lite, ~270MB
# of models downloaded into the mlmodels volume on first run). The first
# run can take several minutes while models download; subsequent runs use
# the persistent cache. --down tears the stack down afterwards.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE=(docker compose -f "$SCRIPT_DIR/docker-compose.yml")
export PINA_ML_PROFILE="${PINA_ML_PROFILE:-cpu-lite}"
# Avoid clashing with a locally running PostgreSQL; the stack only needs the
# internal network, the host mapping is irrelevant for this smoke.
export PINA_POSTGRES_PORT="${PINA_POSTGRES_PORT:-55432}"
TEAR_DOWN="${1:-}"

SMOKE_IMAGE="$REPO_ROOT/frontend/e2e/responsive.spec.ts-snapshots/darwin/login-route-desktop.png"
if [[ ! -f "$SMOKE_IMAGE" ]]; then
  echo "smoke image not found: $SMOKE_IMAGE" >&2
  exit 1
fi

json_field() { python3 -c "import json,sys;print(json.load(sys.stdin)[sys.argv[1]])" "$1"; }

wait_for() {
  local name="$1" url="$2" tries="${3:-60}"
  for ((i = 1; i <= tries; i++)); do
    if curl -fsS -o /dev/null "$url" 2>/dev/null; then
      echo "$name is up"
      return 0
    fi
    sleep 5
  done
  echo "$name did not become ready: $url" >&2
  return 1
}

echo "== starting stack (profile: $PINA_ML_PROFILE)"
"${COMPOSE[@]}" up -d --build postgres ml backend

wait_for "backend" "http://localhost:8080/q/health/ready" 60
wait_for "ml admin" "http://localhost:8000/healthz" 60
echo "ml info: $(curl -fsS http://localhost:8000/api/info)"

USERNAME="smoke-$RANDOM$RANDOM"
echo "== registering user $USERNAME"
TOKEN=$(curl -fsS -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USERNAME\",\"password\":\"smokepass123\"}" \
  http://localhost:8080/api/v1/auth/register | json_field accessToken)

echo "== uploading photo"
PHOTO_ID=$(curl -fsS -H "Authorization: Bearer $TOKEN" \
  -F "file=@$SMOKE_IMAGE;type=image/png" \
  http://localhost:8080/api/v1/photos | json_field id)
echo "photo id: $PHOTO_ID"

psql_query() {
  "${COMPOSE[@]}" exec -T postgres \
    psql -U "${POSTGRES_USER:-pina}" -d "${POSTGRES_DB:-pina}" -tAc "$1"
}

echo "== waiting for ML analysis (first run downloads models; up to 15 min)"
for ((i = 1; i <= 180; i++)); do
  STATUS=$(psql_query "SELECT status FROM photo_analysis_jobs WHERE photo_id = '$PHOTO_ID'" || echo "")
  case "$STATUS" in
    COMPLETED)
      echo "analysis COMPLETED"
      echo "tags: $(psql_query "SELECT string_agg(label || '=' || round(confidence::numeric, 3), ', ') FROM photo_tags WHERE photo_id = '$PHOTO_ID'")"
      echo "embedding rows: $(psql_query "SELECT count(*) FROM photo_embeddings WHERE photo_id = '$PHOTO_ID'")"
      echo "faces: $(psql_query "SELECT count(*) FROM photo_faces WHERE photo_id = '$PHOTO_ID'")"
      if [[ "$TEAR_DOWN" == "--down" ]]; then "${COMPOSE[@]}" down; fi
      echo "SMOKE OK"
      exit 0
      ;;
    FAILED)
      echo "analysis FAILED: $(psql_query "SELECT last_error FROM photo_analysis_jobs WHERE photo_id = '$PHOTO_ID'")" >&2
      exit 1
      ;;
    *)
      sleep 5
      ;;
  esac
done

echo "timed out waiting for analysis; job state: $(psql_query "SELECT status || ' attempts=' || attempts || ' err=' || COALESCE(last_error,'-') FROM photo_analysis_jobs WHERE photo_id = '$PHOTO_ID'")" >&2
exit 1
