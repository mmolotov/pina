---
id: TASK-053.03
title: ALBM-BE-005 Album public share link
status: Done
assignee: []
created_date: '2026-04-22 12:15'
updated_date: '2026-04-23 11:28'
labels:
  - backend
  - api
dependencies: []
parent_task_id: TASK-053
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

The redesigned tile exposes a "Share" action. The project has `InviteLink` for spaces but no public share mechanism for albums. Until this task lands, the frontend share action is a fallback that copies the owner-only album URL (see ALBM-FE-002 / ALBM-FE-005).

## What to build

A tokenized public read-only album link, modelled after `InviteLinkService` but without the membership semantics:

- New table `album_share_links` with: `id`, `album_id`, `token_hash` (SHA-256, unique, indexed), `created_by`, `created_at`, `expires_at` (nullable), `revoked_at` (nullable).
- `POST /api/v1/albums/{id}/share-links` — owner-only. Body: `{ expiresAt?: string }`. Returns the **plaintext token once**; subsequent reads only expose metadata (same pattern as invite links).
- `GET /api/v1/albums/{id}/share-links` — owner-only list.
- `DELETE /api/v1/albums/{id}/share-links/{linkId}` — owner-only revoke.
- `GET /api/v1/public/albums/by-token/{token}` — anonymous endpoint returning `AlbumDto` + paginated photos if the token is valid and not revoked/expired. Rate-limit via existing infrastructure if available.
- Public photo access (`/photos/{id}/file`) does not change in this task; either the public endpoint returns presigned/proxy URLs, or a follow-up task handles asset access under the token. Decide in implementation and document in the PR.

## Out of scope

- Embedding the album on external sites.
- Read/write share roles.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 New `album_share_links` table with secure token-hash storage (never store raw tokens)
- [x] #2 `POST /albums/{id}/share-links` returns the plaintext token once and only to the owner
- [x] #3 `DELETE /albums/{id}/share-links/{linkId}` revokes a link; subsequent public reads return 404/410
- [x] #4 `GET /public/albums/by-token/{token}` returns album metadata and photos for valid tokens, honouring expiry and revocation
- [x] #5 Integration tests cover creation, retrieval, expiry, revocation, and anonymous access with valid and invalid tokens
- [x] #6 Decision on how photo assets are retrieved via share token is captured in PR description and docs
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
New `album_share_links` table (migration `V03__album_share_links.sql`) with columns `id`, `album_id` (FK → `albums` ON DELETE CASCADE), `token_hash` (VARCHAR(64), UNIQUE), `created_by` (FK → `users`), `created_at`, `expires_at` (nullable), `revoked_at` (nullable). Only the SHA-256 hex hash of the token is persisted — the raw token leaves the server exactly once, in the `POST` response.

`AlbumShareLinkService` generates tokens as 32 random bytes via `SecureRandom`, URL-safe base64-encoded without padding (≈43 chars). `findValidByToken(raw)` re-hashes the input and filters out rows where `revokedAt != null` or `expiresAt <= now()`. Revocation sets `revokedAt = now()` — soft delete to keep audit trail.

Owner-side endpoints live on `AlbumResource`, reusing the same `album.owner.id == user.id` check as the other album endpoints:
- `POST /api/v1/albums/{id}/share-links` — body `{ expiresAt?: string }`, returns 201 with `AlbumShareLinkCreatedDto { link, token }`. The plaintext `token` field is present ONLY in this response.
- `GET /api/v1/albums/{id}/share-links` — returns the owner's links as `AlbumShareLinkDto[]` (never includes the token).
- `DELETE /api/v1/albums/{id}/share-links/{linkId}` — soft-revokes; returns 204 or 404.

Anonymous access is served by `PublicAlbumResource` under `/api/v1/public/albums/*` (permit-all path registered in `application.properties`):
- `GET /public/albums/by-token/{token}` — returns `{ album: AlbumDto, photos: PageResponse<PhotoDto> }`. 404 on unknown/revoked/expired.
- `GET /public/albums/by-token/{token}/photos/{photoId}/file?variant=…` — streams the photo variant through the server. Validates the token on every request, verifies the photo belongs to the linked album (`albumService.hasPhoto`), and returns 400 for invalid variant / 404 for missing variant or non-member photo.

**Decision for AC #6** (photo asset access via share token): asset requests are proxied through a public endpoint that re-validates the token on every call, rather than issuing presigned/CDN URLs. This keeps revocation immediate (no cached URLs survive a revoke), requires no changes to the `StorageProvider` SPI, and matches the existing owner-side streaming pattern in `PhotoResource.getFile`. Follow-up work may introduce signed URLs once the storage layer supports them.

Nine integration tests in `AlbumShareLinkResourceTest` cover: plaintext token returned once + list hides token; non-owner gets 404 on create/list/revoke; anonymous valid-token read returns album + photos; invalid token → 404; revoked link → 404 on both metadata and photo-file endpoints; past `expiresAt` → 404; photo proxy streams non-empty bytes; invalid `variant` → 400; photo outside the linked album → 404. `spotlessCheck`, `spotbugsMain`, and `./gradlew build` are green.
<!-- SECTION:NOTES:END -->
