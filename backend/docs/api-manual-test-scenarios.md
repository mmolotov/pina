# Backend API Manual Test Scenarios

This file describes manual API test scenarios for the current backend.
Each scenario contains:

- what to prepare
- step-by-step actions
- `curl` commands
- expected result

All examples assume the backend is running locally on `http://localhost:8080`.

For a reproducible end-to-end smoke run of this document, use
`../scripts/manual-smoke.sh`. The script exercises the same non-admin backend API flow with
generated test users and automatic assertions. It intentionally covers the current authenticated,
library, Spaces, invites, and favorites surface. Instance-level admin endpoints are implemented,
but they remain out of scope for this smoke script and are covered by dedicated integration tests.
It is intended for local release/smoke
verification, not as a replacement for automated integration tests in `../src/test`.

For a separate admin-focused smoke path, use `../scripts/manual-admin-smoke.sh`.

## Preconditions

1. Start the backend.
2. Prepare one local image file for upload, for example:

```bash
export PHOTO_FILE="/absolute/path/to/test-image.jpg"
```

The same `PHOTO_FILE` may be reused across different users. Upload deduplication is scoped per uploader:
the same user re-uploading the same file gets the existing asset back, while a different user can upload the same bytes independently.

If you want to run the geo scenarios manually, also prepare two JPEG files with GPS EXIF metadata:

- one photo inside the viewport around Belgrade, Serbia, used below (`latitude ~= 44.8176`, `longitude ~= 20.4633`)
- one photo clearly outside that viewport, for example Paris, France (`latitude ~= 48.8566`, `longitude ~= 2.3522`)

Example variables:

```bash
export GEO_PHOTO_INSIDE_FILE="/absolute/path/to/geo-belgrade.jpg"
export GEO_PHOTO_OUTSIDE_FILE="/absolute/path/to/geo-paris.jpg"
```

The smoke script generates its own embedded geo fixtures automatically; these extra files are needed only for the manual curl walkthrough in this document.

3. Prepare a base URL, a unique run suffix, and content type helpers:

```bash
export BASE_URL="http://localhost:8080/api/v1"
export RUN_ID="$(date +%s)"
export JSON_HEADER="Content-Type: application/json"
```

4. Use two test users:

```bash
export USER_A_USERNAME="manual_user_a_$RUN_ID"
export USER_A_PASSWORD="manual-pass-a"
export USER_A_NAME="Manual User A"
export USER_A_EMAIL="manual-user-a-$RUN_ID@example.com"

export USER_B_USERNAME="manual_user_b_$RUN_ID"
export USER_B_PASSWORD="manual-pass-b"
export USER_B_NAME="Manual User B"
```

5. After create/login calls, copy IDs and tokens from the JSON response into shell variables manually:

```bash
export USER_A_ID=""
export USER_B_ID=""
export USER_A_ACCESS_TOKEN=""
export USER_A_REFRESH_TOKEN=""
export USER_B_ACCESS_TOKEN=""
export USER_B_REFRESH_TOKEN=""
export USER_A_PHOTO_ID=""
export USER_A_ALBUM_ID=""
export USER_A_GEO_INSIDE_PHOTO_ID=""
export USER_A_GEO_OUTSIDE_PHOTO_ID=""
export USER_B_PHOTO_ID=""
export USER_B_ALBUM_ID=""
export SPACE_ID=""
export SUBSPACE_ID=""
export SPACE_ALBUM_ID=""
export INVITE_ID=""
export INVITE_CODE=""
export FAVORITE_ID=""
```

## Scenario 1. Health Check

Description: verify that the backend is reachable and storage stats are available.

```bash
curl -sS -i "$BASE_URL/health"
```

Expected result:

- HTTP status is `200 OK`
- response body contains `"status":"ok"`
- response body contains a `storage` object with `type`, `usedBytes`, and `availableBytes`

## Scenario 2. Register User A

Description: create the first local account.

```bash
curl -sS -i \
  -H "$JSON_HEADER" \
  -X POST "$BASE_URL/auth/register" \
  -d "{\"username\":\"$USER_A_USERNAME\",\"password\":\"$USER_A_PASSWORD\",\"name\":\"$USER_A_NAME\"}"
```

Expected result:

- HTTP status is `201 Created`
- response body contains `accessToken`, `refreshToken`, `expiresIn`
- response body contains `user.id`
- copy `user.id`, `accessToken`, and `refreshToken` into `USER_A_ID`, `USER_A_ACCESS_TOKEN`, and `USER_A_REFRESH_TOKEN`

## Scenario 3. Register User B

Description: create the second local account for multi-user and Space tests.

```bash
curl -sS -i \
  -H "$JSON_HEADER" \
  -X POST "$BASE_URL/auth/register" \
  -d "{\"username\":\"$USER_B_USERNAME\",\"password\":\"$USER_B_PASSWORD\",\"name\":\"$USER_B_NAME\"}"
```

Expected result:

- HTTP status is `201 Created`
- response body contains `user.id`
- copy `user.id`, `accessToken`, and `refreshToken` into `USER_B_ID`, `USER_B_ACCESS_TOKEN`, and `USER_B_REFRESH_TOKEN`

## Scenario 4. Login User A

Description: verify username/password login and token issuance.

```bash
curl -sS -i \
  -H "$JSON_HEADER" \
  -X POST "$BASE_URL/auth/login" \
  -d "{\"username\":\"$USER_A_USERNAME\",\"password\":\"$USER_A_PASSWORD\"}"
```

Expected result:

- HTTP status is `200 OK`
- response body contains fresh `accessToken` and `refreshToken`
- tokens are valid for authenticated endpoints

## Scenario 5. Get And Update Current Profile

Description: verify authenticated profile read and update.

Step 1. Read current profile.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  "$BASE_URL/auth/me"
```

Expected result:

- HTTP status is `200 OK`
- response body contains `id`, `name`, `email`, `avatarUrl`
- `id` matches `USER_A_ID`

Step 2. Update profile.

```bash
curl -sS -i \
  -H "$JSON_HEADER" \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  -X PUT "$BASE_URL/auth/me" \
  -d '{
    "name": "Manual User A Updated",
    "email": "'"$USER_A_EMAIL"'"
  }'
```

Expected result:

- HTTP status is `200 OK`
- response body contains updated `name` and `email`

## Scenario 6. Upload, List, Read, And Download A Photo

Description: verify personal photo lifecycle for the uploader.

Step 1. Upload a photo.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  -F "file=@$PHOTO_FILE" \
  "$BASE_URL/photos"
```

Expected result:

- HTTP status is `201 Created`
- response body contains `id`, `uploaderId`, `originalFilename`, `mimeType`, and `variants`
- `uploaderId` matches `USER_A_ID`
- copy returned `id` into `USER_A_PHOTO_ID`

Step 2. List current user's photos.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  "$BASE_URL/photos?page=0&size=20&needsTotal=true"
```

Expected result:

- HTTP status is `200 OK`
- response body contains `items`
- uploaded photo is present in `items`
- pagination fields include `page`, `size`, `hasNext`, `totalItems`, `totalPages`

Step 3. Get photo metadata by ID.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  "$BASE_URL/photos/$USER_A_PHOTO_ID"
```

Expected result:

- HTTP status is `200 OK`
- response body contains the same `id` as `USER_A_PHOTO_ID`

Step 4. Download one processed variant.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  "$BASE_URL/photos/$USER_A_PHOTO_ID/file?variant=COMPRESSED"
```

Expected result:

- HTTP status is `200 OK`
- response has a binary image payload
- `Content-Type` is an image media type such as `image/jpeg`

## Scenario 7. Personal Album Flow And Delete Conflict

Description: verify personal album operations and the delete protection for referenced photos.

Step 1. Create a personal album.

```bash
curl -sS -i \
  -H "$JSON_HEADER" \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  -X POST "$BASE_URL/albums" \
  -d '{
    "name": "Manual Album",
    "description": "Album for manual API test"
  }'
```

Expected result:

- HTTP status is `201 Created`
- response body contains `id`, `ownerId`, and `personalLibraryId`
- copy `id` into `USER_A_ALBUM_ID`

Step 2. Add the photo to the album.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  -X POST "$BASE_URL/albums/$USER_A_ALBUM_ID/photos/$USER_A_PHOTO_ID"
```

Expected result:

- HTTP status is `201 Created`

Step 3. Verify album photo listing.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  "$BASE_URL/albums/$USER_A_ALBUM_ID/photos?page=0&size=20&needsTotal=true"
```

Expected result:

- HTTP status is `200 OK`
- returned `items` contains the photo with `id == USER_A_PHOTO_ID`

Step 4. Try to delete the referenced photo.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  -X DELETE "$BASE_URL/photos/$USER_A_PHOTO_ID"
```

Expected result:

- HTTP status is `409 Conflict`
- response body indicates that the photo still has album references

Step 5. Remove the photo reference.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  -X DELETE "$BASE_URL/albums/$USER_A_ALBUM_ID/photos/$USER_A_PHOTO_ID"
```

Expected result:

- HTTP status is `204 No Content`

Step 6. Delete the album.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  -X DELETE "$BASE_URL/albums/$USER_A_ALBUM_ID"
```

Expected result:

- HTTP status is `204 No Content`

Step 7. Delete the photo again.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  -X DELETE "$BASE_URL/photos/$USER_A_PHOTO_ID"
```

Expected result:

- HTTP status is `204 No Content`

## Scenario 7a. Geo Photo Queries

Description: verify geo-tagged photo upload plus bounding-box and nearby map queries for the current user's personal library.

Step 1. Upload the geo-tagged photo inside the Belgrade viewport as user A.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  -F "file=@$GEO_PHOTO_INSIDE_FILE" \
  "$BASE_URL/photos"
```

Expected result:

- HTTP status is `201 Created`
- response body contains non-null `latitude` and `longitude`
- returned coordinates match the Belgrade-area photo
- copy returned photo ID into `USER_A_GEO_INSIDE_PHOTO_ID`

Step 2. Upload the geo-tagged photo outside the Belgrade viewport as user A.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  -F "file=@$GEO_PHOTO_OUTSIDE_FILE" \
  "$BASE_URL/photos"
```

Expected result:

- HTTP status is `201 Created`
- response body contains non-null `latitude` and `longitude`
- returned coordinates match the outside-viewport photo
- copy returned photo ID into `USER_A_GEO_OUTSIDE_PHOTO_ID`

Step 3. Query geo-tagged photos in the Belgrade bounding box.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  "$BASE_URL/photos/geo?swLat=44.70&swLng=20.30&neLat=44.90&neLng=20.60&page=0&size=20&needsTotal=true"
```

Expected result:

- HTTP status is `200 OK`
- response body contains paginated `items`
- `items` contains `USER_A_GEO_INSIDE_PHOTO_ID`
- `items` does not contain `USER_A_GEO_OUTSIDE_PHOTO_ID`
- the marker payload omits heavy fields: `exifData` is `null` and `variants` is an empty array

Step 4. Query nearby geo-tagged photos around the Belgrade point.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  "$BASE_URL/photos/geo/nearby?lat=44.8176&lng=20.4633&radiusKm=5&page=0&size=20&needsTotal=true"
```

Expected result:

- HTTP status is `200 OK`
- response body contains paginated `items`
- `items` contains `USER_A_GEO_INSIDE_PHOTO_ID`
- `items` does not contain `USER_A_GEO_OUTSIDE_PHOTO_ID`
- photos without GPS coordinates are excluded from both geo result sets

## Scenario 8. Space Creation And Membership

Description: verify Space CRUD entry points and direct membership management.

Step 1. Create a Space as user A.

```bash
curl -sS -i \
  -H "$JSON_HEADER" \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  -X POST "$BASE_URL/spaces" \
  -d '{
    "name": "Manual Space",
    "description": "Main manual test space",
    "visibility": "PRIVATE"
  }'
```

Expected result:

- HTTP status is `201 Created`
- response body contains `id`, `creatorId`, `visibility`, `depth`, and `inheritMembers`
- copy `id` into `SPACE_ID`

Step 2. List spaces for user A.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  "$BASE_URL/spaces"
```

Expected result:

- HTTP status is `200 OK`
- response body is a list
- the created Space appears in the list

Step 3. Add user B as `MEMBER`.

```bash
curl -sS -i \
  -H "$JSON_HEADER" \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  -X POST "$BASE_URL/spaces/$SPACE_ID/members" \
  -d "{\"userId\":\"$USER_B_ID\",\"role\":\"MEMBER\"}"
```

Expected result:

- HTTP status is `201 Created`

Step 4. Verify member listing.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  "$BASE_URL/spaces/$SPACE_ID/members?page=0&size=20&needsTotal=true"
```

Expected result:

- HTTP status is `200 OK`
- response body contains paginated `items` array
- `items` contains user A as `OWNER` and user B as `MEMBER`
- pagination fields include `page`, `size`, `hasNext`, `totalItems`, `totalPages`

## Scenario 9. Subspace Inheritance Visibility

Description: verify that inherited access is reflected both in `/spaces` and `/subspaces`, and that direct child membership still works when inheritance is disabled on a subspace.

Step 1. Create a subspace under the main Space.

```bash
curl -sS -i \
  -H "$JSON_HEADER" \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  -X POST "$BASE_URL/spaces/$SPACE_ID/subspaces" \
  -d '{
    "name": "Manual Subspace",
    "description": "Inherited access test",
    "visibility": "PRIVATE"
  }'
```

Expected result:

- HTTP status is `201 Created`
- response body contains `parentId` equal to `SPACE_ID`
- copy returned `id` into `SUBSPACE_ID`

Step 2. List spaces as user B.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_B_ACCESS_TOKEN" \
  "$BASE_URL/spaces"
```

Expected result:

- HTTP status is `200 OK`
- response contains both `SPACE_ID` and `SUBSPACE_ID`
- this confirms inherited subspace visibility

Step 3. List subspaces under the parent as user B.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_B_ACCESS_TOKEN" \
  "$BASE_URL/spaces/$SPACE_ID/subspaces"
```

Expected result:

- HTTP status is `200 OK`
- response contains the subspace with `id == SUBSPACE_ID`

Step 4. Disable inheritance on the subspace while keeping direct membership possible.

```bash
curl -sS -i \
  -H "$JSON_HEADER" \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  -X PUT "$BASE_URL/spaces/$SUBSPACE_ID" \
  -d '{
    "name": "Manual Subspace",
    "description": "Direct membership test",
    "inheritMembers": false
  }'
```

Expected result:

- HTTP status is `200 OK`
- response body contains `"inheritMembers":false`

Step 5. Re-add user B directly to the subspace as a viewer.

```bash
curl -sS -i \
  -H "$JSON_HEADER" \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  -X POST "$BASE_URL/spaces/$SUBSPACE_ID/members" \
  -d "{\"userId\":\"$USER_B_ID\",\"role\":\"VIEWER\"}"
```

Expected result:

- HTTP status is `201 Created` or `200 OK` if the direct membership already exists

Step 6. List subspaces under the parent as user B again.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_B_ACCESS_TOKEN" \
  "$BASE_URL/spaces/$SPACE_ID/subspaces"
```

Expected result:

- HTTP status is `200 OK`
- response still contains the subspace with `id == SUBSPACE_ID`
- this confirms that direct child membership is sufficient even when inherited visibility is disabled for that child

## Scenario 10. Space Album Permissions

Description: verify Space album creation, photo add, and owner/admin removal rules.

Step 1. Upload a photo as user B. Reusing `PHOTO_FILE` from user A is valid and should still create a separate asset for user B.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_B_ACCESS_TOKEN" \
  -F "file=@$PHOTO_FILE" \
  "$BASE_URL/photos"
```

Expected result:

- HTTP status is `201 Created`
- copy returned photo ID into `USER_B_PHOTO_ID`

Step 2. Create a personal album as user B for negative ownership checks later.

```bash
curl -sS -i \
  -H "$JSON_HEADER" \
  -H "Authorization: Bearer $USER_B_ACCESS_TOKEN" \
  -X POST "$BASE_URL/albums" \
  -d '{
    "name": "User B Personal Album",
    "description": "Album for negative ownership checks"
  }'
```

Expected result:

- HTTP status is `201 Created`
- copy returned album ID into `USER_B_ALBUM_ID`

Step 3. Create a Space album as user B.

```bash
curl -sS -i \
  -H "$JSON_HEADER" \
  -H "Authorization: Bearer $USER_B_ACCESS_TOKEN" \
  -X POST "$BASE_URL/spaces/$SPACE_ID/albums" \
  -d '{
    "name": "Space Album by B",
    "description": "Album owned by member B"
  }'
```

Expected result:

- HTTP status is `201 Created`
- copy returned album ID into `SPACE_ALBUM_ID`

Step 4. Add user B's own photo into the Space album.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_B_ACCESS_TOKEN" \
  -X POST "$BASE_URL/spaces/$SPACE_ID/albums/$SPACE_ALBUM_ID/photos/$USER_B_PHOTO_ID"
```

Expected result:

- HTTP status is `201 Created`

Step 5. List photos in the Space album as user A.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  "$BASE_URL/spaces/$SPACE_ID/albums/$SPACE_ALBUM_ID/photos?page=0&size=20&needsTotal=true"
```

Expected result:

- HTTP status is `200 OK`
- response body contains `items` with the photo added by user B
- pagination fields include `page`, `size`, `hasNext`, `totalItems`, `totalPages`

Step 6. Download the photo through the Space album as user A.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  "$BASE_URL/spaces/$SPACE_ID/albums/$SPACE_ALBUM_ID/photos/$USER_B_PHOTO_ID/file?variant=COMPRESSED"
```

Expected result:

- HTTP status is `200 OK`
- response has a binary image payload
- `Content-Type` is an image media type such as `image/jpeg`

Step 7. Try to remove that photo from the album as user A.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  -X DELETE "$BASE_URL/spaces/$SPACE_ID/albums/$SPACE_ALBUM_ID/photos/$USER_B_PHOTO_ID"
```

Expected result:

- HTTP status is `204 No Content`
- user A is the Space owner, so removal is allowed

Step 8. Re-add the photo as user B.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_B_ACCESS_TOKEN" \
  -X POST "$BASE_URL/spaces/$SPACE_ID/albums/$SPACE_ALBUM_ID/photos/$USER_B_PHOTO_ID"
```

Expected result:

- HTTP status is `201 Created` or `200 OK` if already present

Step 9. Upload a photo as user A for cross-owner negative checks. If you reuse the same `PHOTO_FILE` from Scenario 6, the API may return the existing user-A asset instead of creating a new one. That is fine for this check because ownership remains the same.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  -F "file=@$PHOTO_FILE" \
  "$BASE_URL/photos"
```

Expected result:

- HTTP status is `201 Created`
- copy returned photo ID into `USER_A_PHOTO_ID`

Step 10. Try to add user A's photo by ID into user B's Space album.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_B_ACCESS_TOKEN" \
  -X POST "$BASE_URL/spaces/$SPACE_ID/albums/$SPACE_ALBUM_ID/photos/$USER_A_PHOTO_ID"
```

Expected result:

- HTTP status is `404 Not Found`
- API does not allow adding a photo that is not owned by the caller

## Scenario 11. Invite Preview And Join

Description: verify invite management, public preview, and authenticated join.

Step 1. Create an invite link as user A.

```bash
curl -sS -i \
  -H "$JSON_HEADER" \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  -X POST "$BASE_URL/spaces/$SPACE_ID/invites" \
  -d '{
    "defaultRole": "VIEWER",
    "usageLimit": 5
  }'
```

Expected result:

- HTTP status is `201 Created`
- response contains `id`, `code`, `defaultRole`, `usageLimit`, `usageCount`, and `active`
- copy `id` into `INVITE_ID`
- copy `code` into `INVITE_CODE`

Step 2. List active invites for the Space.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  "$BASE_URL/spaces/$SPACE_ID/invites?page=0&size=20&needsTotal=true"
```

Expected result:

- HTTP status is `200 OK`
- response body contains paginated `items` array
- `items` contains the created invite
- inactive invites must not be included
- pagination fields include `page`, `size`, `hasNext`, `totalItems`, `totalPages`

Step 3. Preview the invite without authentication.

```bash
curl -sS -i "$BASE_URL/invites/$INVITE_CODE"
```

Expected result:

- HTTP status is `200 OK`
- response body contains `spaceName`, `spaceDescription`, and `defaultRole`

Step 4. Join via invite as user B.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_B_ACCESS_TOKEN" \
  -X POST "$BASE_URL/invites/$INVITE_CODE/join"
```

Expected result:

- HTTP status is `200 OK`
- if user B is already a member, the response is still `200 OK`
- user B gains direct or already-effective membership according to current Space state

Step 5. Revoke the invite.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  -X DELETE "$BASE_URL/spaces/$SPACE_ID/invites/$INVITE_ID"
```

Expected result:

- HTTP status is `204 No Content`

Step 6. Preview the revoked invite again.

```bash
curl -sS -i "$BASE_URL/invites/$INVITE_CODE"
```

Expected result:

- HTTP status is `404 Not Found`

Step 7. Create an already-expired invite and verify that preview is hidden.

```bash
curl -sS -i \
  -H "$JSON_HEADER" \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  -X POST "$BASE_URL/spaces/$SPACE_ID/invites" \
  -d '{
    "defaultRole": "VIEWER",
    "expiration": "2000-01-01T00:00:00Z"
  }'
```

Expected result:

- HTTP status is `201 Created`
- copy the returned `code` into `INVITE_CODE`

Then preview it:

```bash
curl -sS -i "$BASE_URL/invites/$INVITE_CODE"
```

Expected result:

- HTTP status is `404 Not Found`
- expired invites must not expose preview metadata

## Scenario 12. Favorites

Description: verify add, list, check, duplicate add, and delete behavior for favorites.

Step 1. Add the Space album to favorites as user B.

```bash
curl -sS -i \
  -H "$JSON_HEADER" \
  -H "Authorization: Bearer $USER_B_ACCESS_TOKEN" \
  -X POST "$BASE_URL/favorites" \
  -d "{\"targetType\":\"ALBUM\",\"targetId\":\"$SPACE_ALBUM_ID\"}"
```

Expected result:

- HTTP status is `201 Created`

Step 2. Add the same favorite again.

```bash
curl -sS -i \
  -H "$JSON_HEADER" \
  -H "Authorization: Bearer $USER_B_ACCESS_TOKEN" \
  -X POST "$BASE_URL/favorites" \
  -d "{\"targetType\":\"ALBUM\",\"targetId\":\"$SPACE_ALBUM_ID\"}"
```

Expected result:

- HTTP status is `200 OK`
- duplicate favorite is not created twice

Step 3. List favorites.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_B_ACCESS_TOKEN" \
  "$BASE_URL/favorites?type=ALBUM&page=0&size=20&needsTotal=true"
```

Expected result:

- HTTP status is `200 OK`
- response body contains paginated `items` array
- `items` contains one favorite pointing to `SPACE_ALBUM_ID`
- copy the favorite's `id` into `FAVORITE_ID`
- pagination fields include `page`, `size`, `hasNext`, `totalItems`, `totalPages`

Step 4. Check favorite status.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_B_ACCESS_TOKEN" \
  "$BASE_URL/favorites/check?targetType=ALBUM&targetId=$SPACE_ALBUM_ID"
```

Expected result:

- HTTP status is `200 OK`
- response body contains `"favorited":true`

Step 5. Remove the favorite.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_B_ACCESS_TOKEN" \
  -X DELETE "$BASE_URL/favorites/$FAVORITE_ID"
```

Expected result:

- HTTP status is `204 No Content`

Step 6. Check favorite status again.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_B_ACCESS_TOKEN" \
  "$BASE_URL/favorites/check?targetType=ALBUM&targetId=$SPACE_ALBUM_ID"
```

Expected result:

- HTTP status is `200 OK`
- response body contains `"favorited":false`

Step 7. Add the Space album to favorites again.

```bash
curl -sS -i \
  -H "$JSON_HEADER" \
  -H "Authorization: Bearer $USER_B_ACCESS_TOKEN" \
  -X POST "$BASE_URL/favorites" \
  -d "{\"targetType\":\"ALBUM\",\"targetId\":\"$SPACE_ALBUM_ID\"}"
```

Expected result:

- HTTP status is `201 Created`

Step 8. Remove user B from the parent Space as user A.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_A_ACCESS_TOKEN" \
  -X DELETE "$BASE_URL/spaces/$SPACE_ID/members/$USER_B_ID"
```

Expected result:

- HTTP status is `204 No Content`

Step 9. List favorites again as user B.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_B_ACCESS_TOKEN" \
  "$BASE_URL/favorites?type=ALBUM&page=0&size=20"
```

Expected result:

- HTTP status is `200 OK`
- response body contains paginated `items` array
- `items` does not include the Space album favorite anymore because user B lost access to that Space
- this remains true even if the album was originally created by user B
- direct membership in a child subspace does not keep a parent-Space album favorite visible

Step 10. Check favorite status for the same album as user B.

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_B_ACCESS_TOKEN" \
  "$BASE_URL/favorites/check?targetType=ALBUM&targetId=$SPACE_ALBUM_ID"
```

Expected result:

- HTTP status is `200 OK`
- response body contains `"favorited":false`

## Scenario 13. Refresh And Logout

Description: verify refresh token rotation and logout invalidation.

Step 1. Exchange refresh token for a new token pair.

```bash
curl -sS -i \
  -H "$JSON_HEADER" \
  -X POST "$BASE_URL/auth/refresh" \
  -d "{\"refreshToken\":\"$USER_A_REFRESH_TOKEN\"}"
```

Expected result:

- HTTP status is `200 OK`
- response contains a new `accessToken` and a new `refreshToken`
- update `USER_A_ACCESS_TOKEN` and `USER_A_REFRESH_TOKEN` with the new values before the next step

Step 2. Logout with the current refresh token.

```bash
curl -sS -i \
  -H "$JSON_HEADER" \
  -X POST "$BASE_URL/auth/logout" \
  -d "{\"refreshToken\":\"$USER_A_REFRESH_TOKEN\"}"
```

Expected result:

- HTTP status is `204 No Content`

Step 3. Try to refresh again with the same refresh token.

```bash
curl -sS -i \
  -H "$JSON_HEADER" \
  -X POST "$BASE_URL/auth/refresh" \
  -d "{\"refreshToken\":\"$USER_A_REFRESH_TOKEN\"}"
```

Expected result:

- HTTP status is `401 Unauthorized`
- response indicates that the refresh token is invalid or expired

## Scenario 14. Negative Authorization Checks

Description: verify key unauthorized and forbidden-by-visibility cases.

Step 1. Try to read a private endpoint without a token.

```bash
curl -sS -i "$BASE_URL/photos"
```

Expected result:

- HTTP status is `401 Unauthorized`

Step 2. Try to add a non-owned photo to a personal album.

Use user A's photo and user B's personal album from the earlier scenarios:

```bash
curl -sS -i \
  -H "Authorization: Bearer $USER_B_ACCESS_TOKEN" \
  -X POST "$BASE_URL/albums/$USER_B_ALBUM_ID/photos/$USER_A_PHOTO_ID"
```

Expected result:

- HTTP status is `404 Not Found`
- API does not allow referencing a photo that is not accessible to the caller

Step 3. Try to join an invite without authentication.

```bash
curl -sS -i \
  -X POST "$BASE_URL/invites/$INVITE_CODE/join"
```

Expected result:

- HTTP status is `401 Unauthorized`

## Optional Scenario. Google Login

Description: verify Google sign-in if the environment is configured with a valid Google client ID.

Precondition:

- backend config contains a valid `pina.auth.google.client-id`
- you have a real Google ID token in `GOOGLE_ID_TOKEN`

```bash
export GOOGLE_ID_TOKEN=""
```

```bash
curl -sS -i \
  -H "$JSON_HEADER" \
  -X POST "$BASE_URL/auth/google" \
  -d "{\"idToken\":\"$GOOGLE_ID_TOKEN\"}"
```

Expected result:

- HTTP status is `200 OK`
- response body contains `accessToken`, `refreshToken`, and `user`

If the token is invalid:

- HTTP status is `401 Unauthorized`
- response indicates invalid Google ID token
