#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8080/api/v1}"
RUN_ID="${RUN_ID:-manual_admin_$(date +%s)}"
JSON_HEADER="Content-Type: application/json"

ADMIN_USERNAME="${ADMIN_USERNAME:-${RUN_ID}_admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-manual-pass-admin}"
ADMIN_NAME="${ADMIN_NAME:-Manual Admin ${RUN_ID}}"
ADMIN_ACCESS_TOKEN="${ADMIN_ACCESS_TOKEN:-}"

REGULAR_USERNAME="${REGULAR_USERNAME:-${RUN_ID}_regular}"
REGULAR_PASSWORD="${REGULAR_PASSWORD:-manual-pass-regular}"
REGULAR_NAME="${REGULAR_NAME:-Manual Regular ${RUN_ID}}"

SPACE_OWNER_USERNAME="${SPACE_OWNER_USERNAME:-${RUN_ID}_owner}"
SPACE_OWNER_PASSWORD="${SPACE_OWNER_PASSWORD:-manual-pass-owner}"
SPACE_OWNER_NAME="${SPACE_OWNER_NAME:-Manual Owner ${RUN_ID}}"
SPACE_NAME="${SPACE_NAME:-Admin Smoke Space ${RUN_ID}}"

SETTINGS_RESTORE_NEEDED=false
ORIGINAL_REGISTRATION_MODE=""
ORIGINAL_COMPRESSION_QUALITY=""

require_bin() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Missing required tool: $name" >&2
    exit 1
  fi
}

restore_settings() {
  if [ "$SETTINGS_RESTORE_NEEDED" != "true" ]; then
    return
  fi
  if [ -z "${ADMIN_ACCESS_TOKEN:-}" ]; then
    return
  fi
  curl --retry 5 --retry-all-errors --retry-connrefused --retry-delay 1 \
    -sS -o /dev/null \
    -H "$JSON_HEADER" \
    -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
    -X PUT "$BASE_URL/admin/settings" \
    -d "{\"compressionQuality\":${ORIGINAL_COMPRESSION_QUALITY},\"registrationMode\":\"${ORIGINAL_REGISTRATION_MODE}\"}" || true
}

curl_json() {
  local method="$1"
  local url="$2"
  local token="${3:-}"
  local data="${4:-}"
  local tmp_body
  tmp_body=$(mktemp)
  local status
  local args=(
    --retry 30
    --retry-all-errors
    --retry-connrefused
    --retry-delay 1
    -sS
    -o "$tmp_body"
    -w "%{http_code}"
    -H "$JSON_HEADER"
    -X "$method"
  )
  if [ -n "$token" ]; then
    args+=(-H "Authorization: Bearer $token")
  fi
  if [ -n "$data" ]; then
    args+=(-d "$data")
  fi
  status=$(curl "${args[@]}" "$url")
  printf '%s\n' "$status"
  cat "$tmp_body"
  rm -f "$tmp_body"
}

curl_text_status() {
  local method="$1"
  local url="$2"
  local token="${3:-}"
  local data="${4:-}"
  local args=(
    --retry 30
    --retry-all-errors
    --retry-connrefused
    --retry-delay 1
    -sS
    -o /dev/null
    -w "%{http_code}"
    -X "$method"
  )
  if [ -n "$token" ]; then
    args+=(-H "Authorization: Bearer $token")
  fi
  if [ -n "$data" ]; then
    args+=(-H "$JSON_HEADER" -d "$data")
  fi
  curl "${args[@]}" "$url"
}

status_of() {
  printf '%s' "$1" | head -n1
}

body_of() {
  printf '%s' "$1" | tail -n +2
}

expect_status() {
  local actual="$1"
  local expected="$2"
  local label="$3"
  if [ "$actual" != "$expected" ]; then
    echo "FAIL: $label (expected HTTP $expected, got $actual)"
    exit 1
  fi
  echo "PASS: $label (HTTP $actual)"
}

expect_jq_true() {
  local json="$1"
  local label="$2"
  shift 2
  if ! printf '%s' "$json" | jq -e "$@" >/dev/null; then
    echo "FAIL: $label"
    printf '%s\n' "$json"
    exit 1
  fi
  echo "PASS: $label"
}

register_user() {
  local username="$1"
  local password="$2"
  local name="$3"
  curl_json POST "$BASE_URL/auth/register" "" \
    "{\"username\":\"${username}\",\"password\":\"${password}\",\"name\":\"${name}\"}"
}

login_user() {
  local username="$1"
  local password="$2"
  curl_json POST "$BASE_URL/auth/login" "" \
    "{\"username\":\"${username}\",\"password\":\"${password}\"}"
}

require_bin curl
require_bin jq
trap restore_settings EXIT

echo "Admin Scenario 1. Public Health Check"
HEALTH_JSON=$(curl --retry 30 --retry-all-errors --retry-connrefused --retry-delay 1 -sS "$BASE_URL/health")
expect_jq_true "$HEALTH_JSON" "Health check returns ok with storage stats" '.status == "ok" and (.storage.type | length > 0)'

echo "Admin Scenario 2. Acquire Admin Session"
if [ -n "$ADMIN_ACCESS_TOKEN" ]; then
  ADMIN_ME=$(curl_json GET "$BASE_URL/auth/me" "$ADMIN_ACCESS_TOKEN")
  STATUS=$(status_of "$ADMIN_ME")
  BODY=$(body_of "$ADMIN_ME")
  expect_status "$STATUS" 200 "Read current admin profile from provided token"
else
  LOGIN_ADMIN=$(login_user "$ADMIN_USERNAME" "$ADMIN_PASSWORD")
  STATUS=$(status_of "$LOGIN_ADMIN")
  if [ "$STATUS" = "200" ]; then
    BODY=$(body_of "$LOGIN_ADMIN")
    ADMIN_ACCESS_TOKEN=$(printf '%s' "$BODY" | jq -r '.accessToken')
    echo "PASS: Login existing admin user (HTTP 200)"
  else
    REGISTER_ADMIN=$(register_user "$ADMIN_USERNAME" "$ADMIN_PASSWORD" "$ADMIN_NAME")
    STATUS=$(status_of "$REGISTER_ADMIN")
    BODY=$(body_of "$REGISTER_ADMIN")
    expect_status "$STATUS" 201 "Register admin bootstrap user"
    ADMIN_ACCESS_TOKEN=$(printf '%s' "$BODY" | jq -r '.accessToken')
    expect_jq_true "$BODY" "Bootstrap registration yields instance admin" '.user.instanceRole == "ADMIN"'
  fi
fi

ADMIN_ME=$(curl_json GET "$BASE_URL/auth/me" "$ADMIN_ACCESS_TOKEN")
STATUS=$(status_of "$ADMIN_ME")
BODY=$(body_of "$ADMIN_ME")
expect_status "$STATUS" 200 "Read admin profile"
expect_jq_true "$BODY" "Authenticated user is active admin" '.instanceRole == "ADMIN" and .active == true'
ADMIN_ID=$(printf '%s' "$BODY" | jq -r '.id')

echo "Admin Scenario 3. Read And Update Admin Settings"
SETTINGS_RESPONSE=$(curl_json GET "$BASE_URL/admin/settings" "$ADMIN_ACCESS_TOKEN")
STATUS=$(status_of "$SETTINGS_RESPONSE")
BODY=$(body_of "$SETTINGS_RESPONSE")
expect_status "$STATUS" 200 "Read admin settings"
expect_jq_true "$BODY" "Admin settings expose registration/compression values" \
  '.registrationMode != null and .compressionFormat != null and .compressionQuality != null and .compressionMaxResolution != null'
ORIGINAL_REGISTRATION_MODE=$(printf '%s' "$BODY" | jq -r '.registrationMode')
ORIGINAL_COMPRESSION_QUALITY=$(printf '%s' "$BODY" | jq -r '.compressionQuality')
SETTINGS_RESTORE_NEEDED=true

if [ "$ORIGINAL_REGISTRATION_MODE" != "OPEN" ]; then
  OPEN_SETTINGS=$(curl_json PUT "$BASE_URL/admin/settings" "$ADMIN_ACCESS_TOKEN" '{"registrationMode":"OPEN"}')
  STATUS=$(status_of "$OPEN_SETTINGS")
  BODY=$(body_of "$OPEN_SETTINGS")
  expect_status "$STATUS" 200 "Temporarily open registration for admin smoke setup"
  expect_jq_true "$BODY" "Registration mode switched to OPEN" '.registrationMode == "OPEN"'
fi

UPDATED_QUALITY=87
if [ "$ORIGINAL_COMPRESSION_QUALITY" = "$UPDATED_QUALITY" ]; then
  UPDATED_QUALITY=86
fi
UPDATE_SETTINGS=$(curl_json PUT "$BASE_URL/admin/settings" "$ADMIN_ACCESS_TOKEN" "{\"compressionQuality\":${UPDATED_QUALITY}}")
STATUS=$(status_of "$UPDATE_SETTINGS")
BODY=$(body_of "$UPDATE_SETTINGS")
expect_status "$STATUS" 200 "Update compression quality through admin settings"
expect_jq_true "$BODY" "Compression quality update is reflected" --argjson quality "$UPDATED_QUALITY" '.compressionQuality == $quality'
RESTORE_SETTINGS=$(curl_json PUT "$BASE_URL/admin/settings" "$ADMIN_ACCESS_TOKEN" "{\"compressionQuality\":${ORIGINAL_COMPRESSION_QUALITY}}")
STATUS=$(status_of "$RESTORE_SETTINGS")
BODY=$(body_of "$RESTORE_SETTINGS")
expect_status "$STATUS" 200 "Restore original compression quality"
expect_jq_true "$BODY" "Original compression quality restored" --argjson quality "$ORIGINAL_COMPRESSION_QUALITY" '.compressionQuality == $quality'

echo "Admin Scenario 4. Non-admin Is Forbidden"
REGISTER_REGULAR=$(register_user "$REGULAR_USERNAME" "$REGULAR_PASSWORD" "$REGULAR_NAME")
STATUS=$(status_of "$REGISTER_REGULAR")
BODY=$(body_of "$REGISTER_REGULAR")
expect_status "$STATUS" 201 "Register regular user for admin authorization checks"
REGULAR_ID=$(printf '%s' "$BODY" | jq -r '.user.id')
REGULAR_ACCESS_TOKEN=$(printf '%s' "$BODY" | jq -r '.accessToken')
FORBIDDEN_STATUS=$(curl_text_status GET "$BASE_URL/admin/users" "$REGULAR_ACCESS_TOKEN")
expect_status "$FORBIDDEN_STATUS" 403 "Non-admin cannot access admin users endpoint"

echo "Admin Scenario 5. Admin User Management"
LIST_USERS=$(curl_json GET "$BASE_URL/admin/users?needsTotal=true&search=${RUN_ID}" "$ADMIN_ACCESS_TOKEN")
STATUS=$(status_of "$LIST_USERS")
BODY=$(body_of "$LIST_USERS")
expect_status "$STATUS" 200 "List users as admin"
expect_jq_true "$BODY" "Admin user list includes regular user" --arg rid "$REGULAR_ID" '.items | map(.id) | index($rid) != null'
GET_USER_DETAIL=$(curl_json GET "$BASE_URL/admin/users/$REGULAR_ID" "$ADMIN_ACCESS_TOKEN")
STATUS=$(status_of "$GET_USER_DETAIL")
BODY=$(body_of "$GET_USER_DETAIL")
expect_status "$STATUS" 200 "Read admin user detail"
expect_jq_true "$BODY" "Admin user detail exposes activation state" --arg rid "$REGULAR_ID" '.id == $rid and .active == true'
DEACTIVATE_USER=$(curl_json PUT "$BASE_URL/admin/users/$REGULAR_ID" "$ADMIN_ACCESS_TOKEN" '{"active":false}')
STATUS=$(status_of "$DEACTIVATE_USER")
BODY=$(body_of "$DEACTIVATE_USER")
expect_status "$STATUS" 200 "Deactivate regular user as admin"
expect_jq_true "$BODY" "Regular user is now inactive" '.active == false'
INACTIVE_LOGIN=$(login_user "$REGULAR_USERNAME" "$REGULAR_PASSWORD")
STATUS=$(status_of "$INACTIVE_LOGIN")
expect_status "$STATUS" 401 "Inactive user cannot log in"

echo "Admin Scenario 6. Global Space And Invite Management"
REGISTER_OWNER=$(register_user "$SPACE_OWNER_USERNAME" "$SPACE_OWNER_PASSWORD" "$SPACE_OWNER_NAME")
STATUS=$(status_of "$REGISTER_OWNER")
BODY=$(body_of "$REGISTER_OWNER")
expect_status "$STATUS" 201 "Register regular Space owner"
SPACE_OWNER_ID=$(printf '%s' "$BODY" | jq -r '.user.id')
SPACE_OWNER_ACCESS_TOKEN=$(printf '%s' "$BODY" | jq -r '.accessToken')
CREATE_SPACE=$(curl_json POST "$BASE_URL/spaces" "$SPACE_OWNER_ACCESS_TOKEN" "{\"name\":\"${SPACE_NAME}\",\"description\":\"Owned by regular user ${RUN_ID}\",\"visibility\":\"PRIVATE\"}")
STATUS=$(status_of "$CREATE_SPACE")
BODY=$(body_of "$CREATE_SPACE")
expect_status "$STATUS" 201 "Create Space as regular owner"
SPACE_ID=$(printf '%s' "$BODY" | jq -r '.id')
CREATE_INVITE=$(curl_json POST "$BASE_URL/spaces/$SPACE_ID/invites" "$SPACE_OWNER_ACCESS_TOKEN" '{"defaultRole":"VIEWER","usageLimit":2}')
STATUS=$(status_of "$CREATE_INVITE")
BODY=$(body_of "$CREATE_INVITE")
expect_status "$STATUS" 201 "Create invite as regular owner"
INVITE_ID=$(printf '%s' "$BODY" | jq -r '.id')
INVITE_CODE=$(printf '%s' "$BODY" | jq -r '.code')

LIST_SPACES=$(curl_json GET "$BASE_URL/admin/spaces?needsTotal=true&search=${RUN_ID}" "$ADMIN_ACCESS_TOKEN")
STATUS=$(status_of "$LIST_SPACES")
BODY=$(body_of "$LIST_SPACES")
expect_status "$STATUS" 200 "List Spaces as admin"
expect_jq_true "$BODY" "Admin Space list includes created Space" --arg sid "$SPACE_ID" '.items | map(.id) | index($sid) != null'
GET_SPACE_DETAIL=$(curl_json GET "$BASE_URL/admin/spaces/$SPACE_ID" "$ADMIN_ACCESS_TOKEN")
STATUS=$(status_of "$GET_SPACE_DETAIL")
BODY=$(body_of "$GET_SPACE_DETAIL")
expect_status "$STATUS" 200 "Read admin Space detail"
expect_jq_true "$BODY" "Admin Space detail exposes creator" --arg sid "$SPACE_ID" --arg owner "$SPACE_OWNER_ID" '.id == $sid and .creatorId == $owner'

LIST_INVITES=$(curl_json GET "$BASE_URL/admin/invites?spaceId=$SPACE_ID&active=true&needsTotal=true" "$ADMIN_ACCESS_TOKEN")
STATUS=$(status_of "$LIST_INVITES")
BODY=$(body_of "$LIST_INVITES")
expect_status "$STATUS" 200 "List global invites as admin"
expect_jq_true "$BODY" "Admin invite list includes created invite" --arg iid "$INVITE_ID" '.items | map(.id) | index($iid) != null'
REVOKE_INVITE_STATUS=$(curl_text_status DELETE "$BASE_URL/admin/invites/$INVITE_ID" "$ADMIN_ACCESS_TOKEN")
expect_status "$REVOKE_INVITE_STATUS" 204 "Revoke invite through admin endpoint"
REVOKED_PREVIEW_STATUS=$(curl_text_status GET "$BASE_URL/invites/$INVITE_CODE")
expect_status "$REVOKED_PREVIEW_STATUS" 404 "Revoked invite is hidden from preview"

echo "Admin Scenario 7. Storage And Health Surfaces"
ADMIN_HEALTH=$(curl_json GET "$BASE_URL/admin/health" "$ADMIN_ACCESS_TOKEN")
STATUS=$(status_of "$ADMIN_HEALTH")
BODY=$(body_of "$ADMIN_HEALTH")
expect_status "$STATUS" 200 "Read admin health"
expect_jq_true "$BODY" "Admin health exposes service metrics" '.status == "UP" and .database.connected == true and .storage.provider != null and .jvm.availableProcessors > 0'
ADMIN_STORAGE=$(curl_json GET "$BASE_URL/admin/storage" "$ADMIN_ACCESS_TOKEN")
STATUS=$(status_of "$ADMIN_STORAGE")
BODY=$(body_of "$ADMIN_STORAGE")
expect_status "$STATUS" 200 "Read admin storage summary"
expect_jq_true "$BODY" "Admin storage summary exposes provider and counters" '.storageProvider != null and .totalPhotos >= 0 and .filesystemAvailableBytes >= 0'
ADMIN_STORAGE_USERS=$(curl_json GET "$BASE_URL/admin/storage/users?needsTotal=true" "$ADMIN_ACCESS_TOKEN")
STATUS=$(status_of "$ADMIN_STORAGE_USERS")
BODY=$(body_of "$ADMIN_STORAGE_USERS")
expect_status "$STATUS" 200 "Read admin per-user storage breakdown"
expect_jq_true "$BODY" "Per-user storage breakdown returns pagination envelope" '.items != null and .page == 0'
ADMIN_STORAGE_SPACES=$(curl_json GET "$BASE_URL/admin/storage/spaces?needsTotal=true" "$ADMIN_ACCESS_TOKEN")
STATUS=$(status_of "$ADMIN_STORAGE_SPACES")
BODY=$(body_of "$ADMIN_STORAGE_SPACES")
expect_status "$STATUS" 200 "Read admin per-Space storage breakdown"
expect_jq_true "$BODY" "Per-Space storage breakdown returns pagination envelope" '.items != null and .page == 0'

if [ "$ORIGINAL_REGISTRATION_MODE" != "OPEN" ]; then
  RESTORE_MODE=$(curl_json PUT "$BASE_URL/admin/settings" "$ADMIN_ACCESS_TOKEN" "{\"registrationMode\":\"${ORIGINAL_REGISTRATION_MODE}\"}")
  STATUS=$(status_of "$RESTORE_MODE")
  BODY=$(body_of "$RESTORE_MODE")
  expect_status "$STATUS" 200 "Restore original registration mode"
  expect_jq_true "$BODY" "Original registration mode restored after admin scenarios" --arg mode "$ORIGINAL_REGISTRATION_MODE" '.registrationMode == $mode'
fi

FINAL_SETTINGS=$(curl_json GET "$BASE_URL/admin/settings" "$ADMIN_ACCESS_TOKEN")
STATUS=$(status_of "$FINAL_SETTINGS")
BODY=$(body_of "$FINAL_SETTINGS")
expect_status "$STATUS" 200 "Read final admin settings"
expect_jq_true "$BODY" "Original registration mode restored" --arg mode "$ORIGINAL_REGISTRATION_MODE" --argjson quality "$ORIGINAL_COMPRESSION_QUALITY" '.registrationMode == $mode and .compressionQuality == $quality'
SETTINGS_RESTORE_NEEDED=false

echo
echo "Manual admin verification finished successfully."
