---
id: TASK-053.03
title: ALBM-BE-005 Album public share link
status: To Do
assignee: []
created_date: '2026-04-22 12:15'
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
- [ ] #1 New `album_share_links` table with secure token-hash storage (never store raw tokens)
- [ ] #2 `POST /albums/{id}/share-links` returns the plaintext token once and only to the owner
- [ ] #3 `DELETE /albums/{id}/share-links/{linkId}` revokes a link; subsequent public reads return 404/410
- [ ] #4 `GET /public/albums/by-token/{token}` returns album metadata and photos for valid tokens, honouring expiry and revocation
- [ ] #5 Integration tests cover creation, retrieval, expiry, revocation, and anonymous access with valid and invalid tokens
- [ ] #6 Decision on how photo assets are retrieved via share token is captured in PR description and docs
<!-- AC:END -->
