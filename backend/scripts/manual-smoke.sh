#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8080/api/v1}"
RUN_ID="${RUN_ID:-manual_phase2_$(date +%s)}"
JSON_HEADER="Content-Type: application/json"
PHOTO_FILE="${PHOTO_FILE:-/tmp/pina-manual-${RUN_ID}.png}"
OWNER_SHARED_SEARCH_FILE="/tmp/pina-owner-search-${RUN_ID}.png"
GEO_PHOTO_INSIDE_FILE="/tmp/pina-manual-geo-inside-${RUN_ID}.jpg"
GEO_PHOTO_OUTSIDE_FILE="/tmp/pina-manual-geo-outside-${RUN_ID}.jpg"

GEO_PHOTO_INSIDE_BASE64='/9j/4QCIRXhpZgAASUkqAAgAAAABACWIBAABAAAAGgAAAAAAAAAEAAEAAgACAAAATgAAAAIABQADAAAAUAAAAAMAAgACAAAARQAAAAQABQADAAAAaAAAAAAAAAAsAAAAAQAAADEAAAABAAAAQIMAABAnAAAUAAAAAQAAABsAAAABAAAAUE4HABAnAAD/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAAKAAoDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCRK2l4AAD/2Q=='
GEO_PHOTO_OUTSIDE_BASE64='/9j/4QCIRXhpZgAASUkqAAgAAAABACWIBAABAAAAGgAAAAAAAAAEAAEAAgACAAAATgAAAAIABQADAAAAUAAAAAMAAgACAAAARQAAAAQABQADAAAAaAAAAAAAAAAwAAAAAQAAADMAAAABAAAAIKADABAnAAACAAAAAQAAABUAAAABAAAAYDUBABAnAAD/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAAKAAoDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCFJosYAAD/2Q=='

# This smoke script intentionally covers the current non-admin backend API surface,
# including the current search contract.
# Instance-level admin endpoints are exercised separately by ./scripts/manual-admin-smoke.sh.

require_bin() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Missing required tool: $name" >&2
    exit 1
  fi
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

curl_multipart() {
  local url="$1"
  local token="$2"
  local file="$3"
  local tmp_body
  tmp_body=$(mktemp)
  local status
  status=$(curl --retry 30 --retry-all-errors --retry-connrefused --retry-delay 1 \
    -sS -o "$tmp_body" -w "%{http_code}" \
    -H "Authorization: Bearer $token" \
    -F "file=@$file" \
    "$url")
  printf '%s\n' "$status"
  cat "$tmp_body"
  rm -f "$tmp_body"
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

expect_status_one_of() {
  local actual="$1"
  local label="$2"
  shift 2
  local expected
  for expected in "$@"; do
    if [ "$actual" = "$expected" ]; then
      echo "PASS: $label (HTTP $actual)"
      return
    fi
  done
  echo "FAIL: $label (got HTTP $actual, expected one of: $*)"
  exit 1
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

cleanup() {
  rm -f "$PHOTO_FILE"
  rm -f "$OWNER_SHARED_SEARCH_FILE"
  rm -f "$GEO_PHOTO_INSIDE_FILE"
  rm -f "$GEO_PHOTO_OUTSIDE_FILE"
}

require_bin curl
require_bin jq
require_bin base64
trap cleanup EXIT

printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7x8AAAAASUVORK5CYII=' | base64 -d > "$PHOTO_FILE"
cp "$PHOTO_FILE" "$OWNER_SHARED_SEARCH_FILE"
printf '%s' "$GEO_PHOTO_INSIDE_BASE64" | base64 -d > "$GEO_PHOTO_INSIDE_FILE"
printf '%s' "$GEO_PHOTO_OUTSIDE_BASE64" | base64 -d > "$GEO_PHOTO_OUTSIDE_FILE"

echo "Scenario 1. Health Check"
HEALTH_JSON=$(curl --retry 30 --retry-all-errors --retry-connrefused --retry-delay 1 -sS "$BASE_URL/health")
expect_jq_true "$HEALTH_JSON" "Health check returns ok with storage stats" '.status == "ok" and (.storage.type | length > 0)'

echo "Scenario 2. Register User A"
REGISTER_A=$(curl_json POST "$BASE_URL/auth/register" "" "{\"username\":\"${RUN_ID}_a\",\"password\":\"manual-pass-a\",\"name\":\"Manual User A\"}")
STATUS=$(status_of "$REGISTER_A")
BODY=$(body_of "$REGISTER_A")
expect_status "$STATUS" 201 "Register user A"
USER_A_ID=$(printf '%s' "$BODY" | jq -r '.user.id')
USER_A_ACCESS_TOKEN=$(printf '%s' "$BODY" | jq -r '.accessToken')
USER_A_REFRESH_TOKEN=$(printf '%s' "$BODY" | jq -r '.refreshToken')

echo "Scenario 3. Register User B"
REGISTER_B=$(curl_json POST "$BASE_URL/auth/register" "" "{\"username\":\"${RUN_ID}_b\",\"password\":\"manual-pass-b\",\"name\":\"Manual User B\"}")
STATUS=$(status_of "$REGISTER_B")
BODY=$(body_of "$REGISTER_B")
expect_status "$STATUS" 201 "Register user B"
USER_B_ID=$(printf '%s' "$BODY" | jq -r '.user.id')
USER_B_ACCESS_TOKEN=$(printf '%s' "$BODY" | jq -r '.accessToken')
USER_B_REFRESH_TOKEN=$(printf '%s' "$BODY" | jq -r '.refreshToken')

echo "Scenario 4. Login User A"
LOGIN_A=$(curl_json POST "$BASE_URL/auth/login" "" "{\"username\":\"${RUN_ID}_a\",\"password\":\"manual-pass-a\"}")
STATUS=$(status_of "$LOGIN_A")
BODY=$(body_of "$LOGIN_A")
expect_status "$STATUS" 200 "Login user A"
USER_A_ACCESS_TOKEN=$(printf '%s' "$BODY" | jq -r '.accessToken')
USER_A_REFRESH_TOKEN=$(printf '%s' "$BODY" | jq -r '.refreshToken')

echo "Scenario 5. Get And Update Current Profile"
ME_A=$(curl_json GET "$BASE_URL/auth/me" "$USER_A_ACCESS_TOKEN")
STATUS=$(status_of "$ME_A")
BODY=$(body_of "$ME_A")
expect_status "$STATUS" 200 "Read current profile"
expect_jq_true "$BODY" "Current profile id matches user A" --arg uid "$USER_A_ID" '.id == $uid'
UPDATED_EMAIL="${RUN_ID}@example.com"
UPDATE_A=$(curl_json PUT "$BASE_URL/auth/me" "$USER_A_ACCESS_TOKEN" "{\"name\":\"Manual User A Updated\",\"email\":\"${UPDATED_EMAIL}\"}")
STATUS=$(status_of "$UPDATE_A")
BODY=$(body_of "$UPDATE_A")
expect_status "$STATUS" 200 "Update current profile"
expect_jq_true "$BODY" "Updated profile email persisted" --arg email "$UPDATED_EMAIL" '.email == $email'

echo "Scenario 6. Upload, List, Read, And Download A Photo"
UPLOAD_A=$(curl_multipart "$BASE_URL/photos" "$USER_A_ACCESS_TOKEN" "$PHOTO_FILE")
STATUS=$(status_of "$UPLOAD_A")
BODY=$(body_of "$UPLOAD_A")
expect_status "$STATUS" 201 "Upload user A photo"
USER_A_PHOTO_ID=$(printf '%s' "$BODY" | jq -r '.id')
LIST_A_PHOTOS=$(curl_json GET "$BASE_URL/photos?page=0&size=20&needsTotal=true" "$USER_A_ACCESS_TOKEN")
STATUS=$(status_of "$LIST_A_PHOTOS")
BODY=$(body_of "$LIST_A_PHOTOS")
expect_status "$STATUS" 200 "List user A photos"
expect_jq_true "$BODY" "Uploaded photo present in personal photo list" --arg pid "$USER_A_PHOTO_ID" '.items | map(.id) | index($pid) != null'
GET_A_PHOTO=$(curl_json GET "$BASE_URL/photos/$USER_A_PHOTO_ID" "$USER_A_ACCESS_TOKEN")
STATUS=$(status_of "$GET_A_PHOTO")
BODY=$(body_of "$GET_A_PHOTO")
expect_status "$STATUS" 200 "Get photo metadata by id"
expect_jq_true "$BODY" "Fetched photo metadata matches uploaded id" --arg pid "$USER_A_PHOTO_ID" '.id == $pid'
PHOTO_DOWNLOAD_STATUS=$(curl_text_status GET "$BASE_URL/photos/$USER_A_PHOTO_ID/file?variant=COMPRESSED" "$USER_A_ACCESS_TOKEN")
expect_status "$PHOTO_DOWNLOAD_STATUS" 200 "Download compressed photo variant"

echo "Scenario 7. Personal Album Flow And Delete Conflict"
CREATE_A_ALBUM=$(curl_json POST "$BASE_URL/albums" "$USER_A_ACCESS_TOKEN" '{"name":"Manual Album","description":"Album for manual API test"}')
STATUS=$(status_of "$CREATE_A_ALBUM")
BODY=$(body_of "$CREATE_A_ALBUM")
expect_status "$STATUS" 201 "Create personal album"
USER_A_ALBUM_ID=$(printf '%s' "$BODY" | jq -r '.id')
ADD_A_PHOTO_TO_ALBUM_STATUS=$(curl_text_status POST "$BASE_URL/albums/$USER_A_ALBUM_ID/photos/$USER_A_PHOTO_ID" "$USER_A_ACCESS_TOKEN")
expect_status "$ADD_A_PHOTO_TO_ALBUM_STATUS" 201 "Add photo to personal album"
LIST_A_ALBUM_PHOTOS=$(curl_json GET "$BASE_URL/albums/$USER_A_ALBUM_ID/photos?page=0&size=20&needsTotal=true" "$USER_A_ACCESS_TOKEN")
STATUS=$(status_of "$LIST_A_ALBUM_PHOTOS")
BODY=$(body_of "$LIST_A_ALBUM_PHOTOS")
expect_status "$STATUS" 200 "List personal album photos"
expect_jq_true "$BODY" "Personal album contains uploaded photo" --arg pid "$USER_A_PHOTO_ID" '.items | map(.id) | index($pid) != null'
DELETE_REFERENCED_PHOTO=$(curl_json DELETE "$BASE_URL/photos/$USER_A_PHOTO_ID" "$USER_A_ACCESS_TOKEN")
STATUS=$(status_of "$DELETE_REFERENCED_PHOTO")
BODY=$(body_of "$DELETE_REFERENCED_PHOTO")
expect_status "$STATUS" 409 "Deleting photo with album reference returns conflict"
REMOVE_A_PHOTO_FROM_ALBUM_STATUS=$(curl_text_status DELETE "$BASE_URL/albums/$USER_A_ALBUM_ID/photos/$USER_A_PHOTO_ID" "$USER_A_ACCESS_TOKEN")
expect_status "$REMOVE_A_PHOTO_FROM_ALBUM_STATUS" 204 "Remove photo from personal album"
DELETE_A_ALBUM_STATUS=$(curl_text_status DELETE "$BASE_URL/albums/$USER_A_ALBUM_ID" "$USER_A_ACCESS_TOKEN")
expect_status "$DELETE_A_ALBUM_STATUS" 204 "Delete personal album"
DELETE_A_PHOTO_STATUS=$(curl_text_status DELETE "$BASE_URL/photos/$USER_A_PHOTO_ID" "$USER_A_ACCESS_TOKEN")
expect_status "$DELETE_A_PHOTO_STATUS" 204 "Delete photo after removing album reference"

echo "Scenario 7a. Geo Photo Queries"
UPLOAD_GEO_INSIDE=$(curl_multipart "$BASE_URL/photos" "$USER_A_ACCESS_TOKEN" "$GEO_PHOTO_INSIDE_FILE")
STATUS=$(status_of "$UPLOAD_GEO_INSIDE")
BODY=$(body_of "$UPLOAD_GEO_INSIDE")
expect_status "$STATUS" 201 "Upload geo-tagged photo inside bounding box"
GEO_INSIDE_ID=$(printf '%s' "$BODY" | jq -r '.id')
expect_jq_true "$BODY" "Inside geo photo exposes expected coordinates" '.latitude > 44.81 and .latitude < 44.82 and .longitude > 20.46 and .longitude < 20.47'
UPLOAD_GEO_OUTSIDE=$(curl_multipart "$BASE_URL/photos" "$USER_A_ACCESS_TOKEN" "$GEO_PHOTO_OUTSIDE_FILE")
STATUS=$(status_of "$UPLOAD_GEO_OUTSIDE")
BODY=$(body_of "$UPLOAD_GEO_OUTSIDE")
expect_status "$STATUS" 201 "Upload geo-tagged photo outside bounding box"
GEO_OUTSIDE_ID=$(printf '%s' "$BODY" | jq -r '.id')
expect_jq_true "$BODY" "Outside geo photo exposes expected coordinates" '.latitude > 48.85 and .latitude < 48.86 and .longitude > 2.35 and .longitude < 2.36'
LIST_GEO_BBOX=$(curl_json GET "$BASE_URL/photos/geo?swLat=44.70&swLng=20.30&neLat=44.90&neLng=20.60&page=0&size=20&needsTotal=true" "$USER_A_ACCESS_TOKEN")
STATUS=$(status_of "$LIST_GEO_BBOX")
BODY=$(body_of "$LIST_GEO_BBOX")
expect_status "$STATUS" 200 "List geo photos in Belgrade bounding box"
expect_jq_true "$BODY" "Bounding box returns only the inside geo photo as marker payload" --arg inside "$GEO_INSIDE_ID" --arg outside "$GEO_OUTSIDE_ID" '.items | length == 1 and any(.id == $inside and .exifData == null and (.variants | length == 0)) and all(.id != $outside)'
LIST_GEO_NEARBY=$(curl_json GET "$BASE_URL/photos/geo/nearby?lat=44.8176&lng=20.4633&radiusKm=5&page=0&size=20&needsTotal=true" "$USER_A_ACCESS_TOKEN")
STATUS=$(status_of "$LIST_GEO_NEARBY")
BODY=$(body_of "$LIST_GEO_NEARBY")
expect_status "$STATUS" 200 "List nearby geo photos around Belgrade point"
expect_jq_true "$BODY" "Nearby query returns only the close geo photo" --arg inside "$GEO_INSIDE_ID" --arg outside "$GEO_OUTSIDE_ID" '.items | length == 1 and .[0].id == $inside and all(.id != $outside)'

echo "Scenario 8. Space Membership Flow"
CREATE_SPACE=$(curl_json POST "$BASE_URL/spaces" "$USER_A_ACCESS_TOKEN" '{"name":"Manual Space","description":"Main manual test space","visibility":"PRIVATE"}')
STATUS=$(status_of "$CREATE_SPACE")
BODY=$(body_of "$CREATE_SPACE")
expect_status "$STATUS" 201 "Create space"
SPACE_ID=$(printf '%s' "$BODY" | jq -r '.id')
ADD_SPACE_MEMBER=$(curl_json POST "$BASE_URL/spaces/$SPACE_ID/members" "$USER_A_ACCESS_TOKEN" "{\"userId\":\"${USER_B_ID}\",\"role\":\"MEMBER\"}")
STATUS=$(status_of "$ADD_SPACE_MEMBER")
expect_status "$STATUS" 201 "Add user B as member"
LIST_SPACE_MEMBERS=$(curl_json GET "$BASE_URL/spaces/$SPACE_ID/members?page=0&size=20&needsTotal=true" "$USER_A_ACCESS_TOKEN")
STATUS=$(status_of "$LIST_SPACE_MEMBERS")
BODY=$(body_of "$LIST_SPACE_MEMBERS")
expect_status "$STATUS" 200 "List space members"
expect_jq_true "$BODY" "Space members contain A as OWNER and B as MEMBER" --arg ua "$USER_A_ID" --arg ub "$USER_B_ID" '.items | any(.userId == $ua and .role == "OWNER") and any(.userId == $ub and .role == "MEMBER")'

echo "Scenario 9. Subspace Inheritance Visibility"
CREATE_SUBSPACE=$(curl_json POST "$BASE_URL/spaces/$SPACE_ID/subspaces" "$USER_A_ACCESS_TOKEN" '{"name":"Manual Subspace","description":"Inherited access test","visibility":"PRIVATE"}')
STATUS=$(status_of "$CREATE_SUBSPACE")
BODY=$(body_of "$CREATE_SUBSPACE")
expect_status "$STATUS" 201 "Create subspace"
SUBSPACE_ID=$(printf '%s' "$BODY" | jq -r '.id')
LIST_SPACES_B=$(curl_json GET "$BASE_URL/spaces" "$USER_B_ACCESS_TOKEN")
STATUS=$(status_of "$LIST_SPACES_B")
BODY=$(body_of "$LIST_SPACES_B")
expect_status "$STATUS" 200 "List spaces as user B"
expect_jq_true "$BODY" "User B sees both parent space and subspace" --arg sid "$SPACE_ID" --arg subid "$SUBSPACE_ID" 'map(.id) | index($sid) != null and index($subid) != null'
LIST_SUBSPACES_B=$(curl_json GET "$BASE_URL/spaces/$SPACE_ID/subspaces" "$USER_B_ACCESS_TOKEN")
STATUS=$(status_of "$LIST_SUBSPACES_B")
BODY=$(body_of "$LIST_SUBSPACES_B")
expect_status "$STATUS" 200 "List subspaces as user B"
expect_jq_true "$BODY" "User B sees subspace via inherited access" --arg subid "$SUBSPACE_ID" 'map(.id) | index($subid) != null'
UPDATE_SUBSPACE=$(curl_json PUT "$BASE_URL/spaces/$SUBSPACE_ID" "$USER_A_ACCESS_TOKEN" '{"name":"Manual Subspace","description":"Direct membership test","inheritMembers":false}')
STATUS=$(status_of "$UPDATE_SUBSPACE")
BODY=$(body_of "$UPDATE_SUBSPACE")
expect_status "$STATUS" 200 "Disable subspace inheritance"
expect_jq_true "$BODY" "Subspace inheritance disabled" '.inheritMembers == false'
ADD_DIRECT_SUB_MEMBER=$(curl_json POST "$BASE_URL/spaces/$SUBSPACE_ID/members" "$USER_A_ACCESS_TOKEN" "{\"userId\":\"${USER_B_ID}\",\"role\":\"VIEWER\"}")
STATUS=$(status_of "$ADD_DIRECT_SUB_MEMBER")
expect_status "$STATUS" 201 "Add direct child membership for user B"
LIST_SUBSPACES_B2=$(curl_json GET "$BASE_URL/spaces/$SPACE_ID/subspaces" "$USER_B_ACCESS_TOKEN")
STATUS=$(status_of "$LIST_SUBSPACES_B2")
BODY=$(body_of "$LIST_SUBSPACES_B2")
expect_status "$STATUS" 200 "List subspaces as user B after disabling inheritance"
expect_jq_true "$BODY" "Direct child membership keeps subspace visible" --arg subid "$SUBSPACE_ID" 'map(.id) | index($subid) != null'

echo "Scenario 10. Space Album Permissions"
UPLOAD_B=$(curl_multipart "$BASE_URL/photos" "$USER_B_ACCESS_TOKEN" "$PHOTO_FILE")
STATUS=$(status_of "$UPLOAD_B")
BODY=$(body_of "$UPLOAD_B")
expect_status "$STATUS" 201 "Upload user B photo"
USER_B_PHOTO_ID=$(printf '%s' "$BODY" | jq -r '.id')
CREATE_B_PERSONAL_ALBUM=$(curl_json POST "$BASE_URL/albums" "$USER_B_ACCESS_TOKEN" '{"name":"User B Personal Album","description":"Album for negative ownership checks"}')
STATUS=$(status_of "$CREATE_B_PERSONAL_ALBUM")
BODY=$(body_of "$CREATE_B_PERSONAL_ALBUM")
expect_status "$STATUS" 201 "Create user B personal album"
USER_B_ALBUM_ID=$(printf '%s' "$BODY" | jq -r '.id')
CREATE_SPACE_ALBUM=$(curl_json POST "$BASE_URL/spaces/$SPACE_ID/albums" "$USER_B_ACCESS_TOKEN" '{"name":"Space Album by B","description":"Album owned by member B"}')
STATUS=$(status_of "$CREATE_SPACE_ALBUM")
BODY=$(body_of "$CREATE_SPACE_ALBUM")
expect_status "$STATUS" 201 "Create space album as user B"
SPACE_ALBUM_ID=$(printf '%s' "$BODY" | jq -r '.id')
ADD_B_PHOTO_TO_SPACE_ALBUM_STATUS=$(curl_text_status POST "$BASE_URL/spaces/$SPACE_ID/albums/$SPACE_ALBUM_ID/photos/$USER_B_PHOTO_ID" "$USER_B_ACCESS_TOKEN")
expect_status "$ADD_B_PHOTO_TO_SPACE_ALBUM_STATUS" 201 "Add user B photo to Space album"
LIST_SPACE_ALBUM_PHOTOS=$(curl_json GET "$BASE_URL/spaces/$SPACE_ID/albums/$SPACE_ALBUM_ID/photos?page=0&size=20&needsTotal=true" "$USER_A_ACCESS_TOKEN")
STATUS=$(status_of "$LIST_SPACE_ALBUM_PHOTOS")
BODY=$(body_of "$LIST_SPACE_ALBUM_PHOTOS")
expect_status "$STATUS" 200 "List Space album photos as user A"
expect_jq_true "$BODY" "User A sees B photo in Space album" --arg pid "$USER_B_PHOTO_ID" '.items | map(.id) | index($pid) != null'
SPACE_ALBUM_DOWNLOAD_STATUS=$(curl_text_status GET "$BASE_URL/spaces/$SPACE_ID/albums/$SPACE_ALBUM_ID/photos/$USER_B_PHOTO_ID/file?variant=COMPRESSED" "$USER_A_ACCESS_TOKEN")
expect_status "$SPACE_ALBUM_DOWNLOAD_STATUS" 200 "Download Space album photo as user A"
REMOVE_B_PHOTO_AS_OWNER_STATUS=$(curl_text_status DELETE "$BASE_URL/spaces/$SPACE_ID/albums/$SPACE_ALBUM_ID/photos/$USER_B_PHOTO_ID" "$USER_A_ACCESS_TOKEN")
expect_status "$REMOVE_B_PHOTO_AS_OWNER_STATUS" 204 "User A removes photo from Space album"
READD_B_PHOTO_STATUS=$(curl_text_status POST "$BASE_URL/spaces/$SPACE_ID/albums/$SPACE_ALBUM_ID/photos/$USER_B_PHOTO_ID" "$USER_B_ACCESS_TOKEN")
expect_status_one_of "$READD_B_PHOTO_STATUS" "User B re-adds photo to Space album" 201 200
REUPLOAD_A=$(curl_multipart "$BASE_URL/photos" "$USER_A_ACCESS_TOKEN" "$PHOTO_FILE")
STATUS=$(status_of "$REUPLOAD_A")
BODY=$(body_of "$REUPLOAD_A")
expect_status "$STATUS" 201 "Re-upload user A photo"
USER_A_PHOTO_ID=$(printf '%s' "$BODY" | jq -r '.id')
ADD_A_PHOTO_TO_B_ALBUM_STATUS=$(curl_text_status POST "$BASE_URL/spaces/$SPACE_ID/albums/$SPACE_ALBUM_ID/photos/$USER_A_PHOTO_ID" "$USER_B_ACCESS_TOKEN")
expect_status "$ADD_A_PHOTO_TO_B_ALBUM_STATUS" 404 "User B cannot add user A photo to Space album"

echo "Scenario 11. Search Result Context And Paging"
UPLOAD_OWNER_SHARED_SEARCH=$(curl_multipart "$BASE_URL/photos" "$USER_A_ACCESS_TOKEN" "$OWNER_SHARED_SEARCH_FILE")
STATUS=$(status_of "$UPLOAD_OWNER_SHARED_SEARCH")
BODY=$(body_of "$UPLOAD_OWNER_SHARED_SEARCH")
expect_status "$STATUS" 201 "Upload owner-shared search photo"
OWNER_SHARED_SEARCH_PHOTO_ID=$(printf '%s' "$BODY" | jq -r '.id')
expect_jq_true "$BODY" "Owner-shared search photo keeps distinct filename" --arg filename "pina-owner-search-${RUN_ID}.png" '.originalFilename == $filename'
ADD_OWNER_SHARED_TO_SPACE_ALBUM_STATUS=$(curl_text_status POST "$BASE_URL/spaces/$SPACE_ID/albums/$SPACE_ALBUM_ID/photos/$OWNER_SHARED_SEARCH_PHOTO_ID" "$USER_A_ACCESS_TOKEN")
expect_status "$ADD_OWNER_SHARED_TO_SPACE_ALBUM_STATUS" 201 "Add owner-shared search photo to Space album"
ADD_OWNER_SHARED_PHOTO_FAVORITE=$(curl_json POST "$BASE_URL/favorites" "$USER_A_ACCESS_TOKEN" "{\"targetType\":\"PHOTO\",\"targetId\":\"${OWNER_SHARED_SEARCH_PHOTO_ID}\"}")
STATUS=$(status_of "$ADD_OWNER_SHARED_PHOTO_FAVORITE")
expect_status "$STATUS" 201 "Favorite owner-shared search photo"
SEARCH_SPACES_OWNER_SHARED=$(curl_json GET "$BASE_URL/search?q=owner-search-${RUN_ID}&scope=spaces&kind=photo&needsTotal=true" "$USER_A_ACCESS_TOKEN")
STATUS=$(status_of "$SEARCH_SPACES_OWNER_SHARED")
BODY=$(body_of "$SEARCH_SPACES_OWNER_SHARED")
expect_status "$STATUS" 200 "Search owner-shared photo in spaces scope"
expect_jq_true "$BODY" "Spaces search keeps Space routing context" --arg pid "$OWNER_SHARED_SEARCH_PHOTO_ID" --arg sid "$SPACE_ID" --arg aid "$SPACE_ALBUM_ID" '.items | length == 1 and .[0].entryScope == "SPACES" and .[0].photo.photo.id == $pid and .[0].photo.spaceId == $sid and .[0].photo.albumId == $aid'
SEARCH_ALL_OWNER_SHARED=$(curl_json GET "$BASE_URL/search?q=owner-search-${RUN_ID}&scope=all&kind=photo&needsTotal=true" "$USER_A_ACCESS_TOKEN")
STATUS=$(status_of "$SEARCH_ALL_OWNER_SHARED")
BODY=$(body_of "$SEARCH_ALL_OWNER_SHARED")
expect_status "$STATUS" 200 "Search owner-shared photo in all scope"
expect_jq_true "$BODY" "All-scope search keeps library entry scope while preserving Space metadata" --arg sid "$SPACE_ID" --arg aid "$SPACE_ALBUM_ID" '.items | length == 1 and .[0].entryScope == "LIBRARY" and .[0].photo.spaceId == $sid and .[0].photo.albumId == $aid'
SEARCH_FAVORITES_OWNER_SHARED=$(curl_json GET "$BASE_URL/search?q=owner-search-${RUN_ID}&scope=favorites&kind=photo&needsTotal=true" "$USER_A_ACCESS_TOKEN")
STATUS=$(status_of "$SEARCH_FAVORITES_OWNER_SHARED")
BODY=$(body_of "$SEARCH_FAVORITES_OWNER_SHARED")
expect_status "$STATUS" 200 "Search owner-shared photo in favorites scope"
expect_jq_true "$BODY" "Favorites search keeps Space routing context for owner-shared photo" --arg pid "$OWNER_SHARED_SEARCH_PHOTO_ID" --arg sid "$SPACE_ID" --arg aid "$SPACE_ALBUM_ID" '.items | length == 1 and .[0].entryScope == "SPACES" and .[0].favorited == true and .[0].photo.photo.id == $pid and .[0].photo.spaceId == $sid and .[0].photo.albumId == $aid'
SEARCH_STALE_PAGE_OWNER_SHARED=$(curl_json GET "$BASE_URL/search?q=owner-search-${RUN_ID}&scope=all&kind=photo&page=3&size=1&needsTotal=true" "$USER_A_ACCESS_TOKEN")
STATUS=$(status_of "$SEARCH_STALE_PAGE_OWNER_SHARED")
BODY=$(body_of "$SEARCH_STALE_PAGE_OWNER_SHARED")
expect_status "$STATUS" 200 "Search owner-shared photo with stale page index"
expect_jq_true "$BODY" "Out-of-range search page still returns stable pagination metadata" '.items == [] and .page == 3 and .hasNext == false and .totalItems == 1 and .totalPages == 1'

echo "Scenario 12. Invite Preview And Join"
CREATE_INVITE=$(curl_json POST "$BASE_URL/spaces/$SPACE_ID/invites" "$USER_A_ACCESS_TOKEN" '{"defaultRole":"VIEWER","usageLimit":5}')
STATUS=$(status_of "$CREATE_INVITE")
BODY=$(body_of "$CREATE_INVITE")
expect_status "$STATUS" 201 "Create invite link"
INVITE_ID=$(printf '%s' "$BODY" | jq -r '.id')
INVITE_CODE=$(printf '%s' "$BODY" | jq -r '.code')
LIST_INVITES=$(curl_json GET "$BASE_URL/spaces/$SPACE_ID/invites?page=0&size=20" "$USER_A_ACCESS_TOKEN")
STATUS=$(status_of "$LIST_INVITES")
BODY=$(body_of "$LIST_INVITES")
expect_status "$STATUS" 200 "List active invites"
expect_jq_true "$BODY" "Created invite appears in invite list" --arg iid "$INVITE_ID" '.items | map(.id) | index($iid) != null'
PREVIEW_INVITE=$(curl_json GET "$BASE_URL/invites/$INVITE_CODE")
STATUS=$(status_of "$PREVIEW_INVITE")
BODY=$(body_of "$PREVIEW_INVITE")
expect_status "$STATUS" 200 "Preview invite without auth"
expect_jq_true "$BODY" "Invite preview contains expected metadata" '.spaceName == "Manual Space" and .defaultRole == "VIEWER"'
JOIN_INVITE_STATUS=$(curl_text_status POST "$BASE_URL/invites/$INVITE_CODE/join" "$USER_B_ACCESS_TOKEN")
expect_status "$JOIN_INVITE_STATUS" 200 "Join via invite as user B"
REVOKE_INVITE_STATUS=$(curl_text_status DELETE "$BASE_URL/spaces/$SPACE_ID/invites/$INVITE_ID" "$USER_A_ACCESS_TOKEN")
expect_status "$REVOKE_INVITE_STATUS" 204 "Revoke invite"
REVOKED_PREVIEW_STATUS=$(curl_text_status GET "$BASE_URL/invites/$INVITE_CODE")
expect_status "$REVOKED_PREVIEW_STATUS" 404 "Preview revoked invite"
CREATE_EXPIRED_INVITE=$(curl_json POST "$BASE_URL/spaces/$SPACE_ID/invites" "$USER_A_ACCESS_TOKEN" '{"defaultRole":"VIEWER","expiration":"2000-01-01T00:00:00Z"}')
STATUS=$(status_of "$CREATE_EXPIRED_INVITE")
BODY=$(body_of "$CREATE_EXPIRED_INVITE")
expect_status "$STATUS" 201 "Create expired invite"
EXPIRED_INVITE_CODE=$(printf '%s' "$BODY" | jq -r '.code')
EXPIRED_PREVIEW_STATUS=$(curl_text_status GET "$BASE_URL/invites/$EXPIRED_INVITE_CODE")
expect_status "$EXPIRED_PREVIEW_STATUS" 404 "Preview expired invite"

echo "Scenario 13. Favorites"
ADD_SPACE_ALBUM_FAVORITE=$(curl_json POST "$BASE_URL/favorites" "$USER_B_ACCESS_TOKEN" "{\"targetType\":\"ALBUM\",\"targetId\":\"${SPACE_ALBUM_ID}\"}")
STATUS=$(status_of "$ADD_SPACE_ALBUM_FAVORITE")
expect_status "$STATUS" 201 "Add Space album to favorites"
DUP_SPACE_ALBUM_FAVORITE=$(curl_json POST "$BASE_URL/favorites" "$USER_B_ACCESS_TOKEN" "{\"targetType\":\"ALBUM\",\"targetId\":\"${SPACE_ALBUM_ID}\"}")
STATUS=$(status_of "$DUP_SPACE_ALBUM_FAVORITE")
expect_status "$STATUS" 200 "Add duplicate Space album favorite"
LIST_FAVORITES=$(curl_json GET "$BASE_URL/favorites?type=ALBUM&page=0&size=20" "$USER_B_ACCESS_TOKEN")
STATUS=$(status_of "$LIST_FAVORITES")
BODY=$(body_of "$LIST_FAVORITES")
expect_status "$STATUS" 200 "List album favorites"
expect_jq_true "$BODY" "Album favorites contain Space album" --arg aid "$SPACE_ALBUM_ID" '.items | map(.targetId) | index($aid) != null'
FAVORITE_ID=$(printf '%s' "$BODY" | jq -r '.items[0].id')
CHECK_FAVORITE=$(curl_json GET "$BASE_URL/favorites/check?targetType=ALBUM&targetId=$SPACE_ALBUM_ID" "$USER_B_ACCESS_TOKEN")
STATUS=$(status_of "$CHECK_FAVORITE")
BODY=$(body_of "$CHECK_FAVORITE")
expect_status "$STATUS" 200 "Check favorite status before removal"
expect_jq_true "$BODY" "Favorite check is true before deletion" '.favorited == true'
REMOVE_FAVORITE_STATUS=$(curl_text_status DELETE "$BASE_URL/favorites/$FAVORITE_ID" "$USER_B_ACCESS_TOKEN")
expect_status "$REMOVE_FAVORITE_STATUS" 204 "Remove favorite"
CHECK_FAVORITE_AFTER_REMOVE=$(curl_json GET "$BASE_URL/favorites/check?targetType=ALBUM&targetId=$SPACE_ALBUM_ID" "$USER_B_ACCESS_TOKEN")
STATUS=$(status_of "$CHECK_FAVORITE_AFTER_REMOVE")
BODY=$(body_of "$CHECK_FAVORITE_AFTER_REMOVE")
expect_status "$STATUS" 200 "Check favorite status after removal"
expect_jq_true "$BODY" "Favorite check is false after deletion" '.favorited == false'
READD_FAVORITE=$(curl_json POST "$BASE_URL/favorites" "$USER_B_ACCESS_TOKEN" "{\"targetType\":\"ALBUM\",\"targetId\":\"${SPACE_ALBUM_ID}\"}")
STATUS=$(status_of "$READD_FAVORITE")
expect_status "$STATUS" 201 "Re-add favorite before access loss"
REMOVE_SPACE_MEMBER_STATUS=$(curl_text_status DELETE "$BASE_URL/spaces/$SPACE_ID/members/$USER_B_ID" "$USER_A_ACCESS_TOKEN")
expect_status "$REMOVE_SPACE_MEMBER_STATUS" 204 "Remove user B from parent Space"
LIST_FAVORITES_AFTER_ACCESS_LOSS=$(curl_json GET "$BASE_URL/favorites?type=ALBUM&page=0&size=20" "$USER_B_ACCESS_TOKEN")
STATUS=$(status_of "$LIST_FAVORITES_AFTER_ACCESS_LOSS")
BODY=$(body_of "$LIST_FAVORITES_AFTER_ACCESS_LOSS")
expect_status "$STATUS" 200 "List favorites after access loss"
expect_jq_true "$BODY" "Space album favorite hidden after Space access loss" --arg aid "$SPACE_ALBUM_ID" '.items | map(.targetId) | index($aid) == null'
CHECK_FAVORITE_AFTER_ACCESS_LOSS=$(curl_json GET "$BASE_URL/favorites/check?targetType=ALBUM&targetId=$SPACE_ALBUM_ID" "$USER_B_ACCESS_TOKEN")
STATUS=$(status_of "$CHECK_FAVORITE_AFTER_ACCESS_LOSS")
BODY=$(body_of "$CHECK_FAVORITE_AFTER_ACCESS_LOSS")
expect_status "$STATUS" 200 "Check favorite after access loss"
expect_jq_true "$BODY" "Favorite check is false after Space access loss" '.favorited == false'

echo "Scenario 14. Refresh And Logout"
REFRESH_A=$(curl_json POST "$BASE_URL/auth/refresh" "" "{\"refreshToken\":\"${USER_A_REFRESH_TOKEN}\"}")
STATUS=$(status_of "$REFRESH_A")
BODY=$(body_of "$REFRESH_A")
expect_status "$STATUS" 200 "Refresh token rotation"
USER_A_ACCESS_TOKEN=$(printf '%s' "$BODY" | jq -r '.accessToken')
USER_A_REFRESH_TOKEN=$(printf '%s' "$BODY" | jq -r '.refreshToken')
LOGOUT_A_STATUS=$(curl_text_status POST "$BASE_URL/auth/logout" "" "{\"refreshToken\":\"${USER_A_REFRESH_TOKEN}\"}")
expect_status "$LOGOUT_A_STATUS" 204 "Logout with current refresh token"
REFRESH_AFTER_LOGOUT_STATUS=$(curl_text_status POST "$BASE_URL/auth/refresh" "" "{\"refreshToken\":\"${USER_A_REFRESH_TOKEN}\"}")
expect_status "$REFRESH_AFTER_LOGOUT_STATUS" 401 "Refresh with revoked token"

echo "Scenario 15. Negative Authorization Checks"
PHOTOS_WITHOUT_TOKEN_STATUS=$(curl_text_status GET "$BASE_URL/photos")
expect_status "$PHOTOS_WITHOUT_TOKEN_STATUS" 401 "Photos endpoint without token"
ADD_NON_OWNED_PHOTO_TO_B_ALBUM_STATUS=$(curl_text_status POST "$BASE_URL/albums/$USER_B_ALBUM_ID/photos/$USER_A_PHOTO_ID" "$USER_B_ACCESS_TOKEN")
expect_status "$ADD_NON_OWNED_PHOTO_TO_B_ALBUM_STATUS" 404 "User B cannot add non-owned photo to personal album"
JOIN_INVITE_WITHOUT_AUTH_STATUS=$(curl_text_status POST "$BASE_URL/invites/$INVITE_CODE/join")
expect_status "$JOIN_INVITE_WITHOUT_AUTH_STATUS" 401 "Join invite without auth"

echo
echo "Manual Phase 2 verification finished successfully."
