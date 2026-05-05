---
id: TASK-053.27
title: TASK-53-BE-REVIEW Signed short-lived URL for album archive download
status: Done
assignee: []
created_date: '2026-04-24 06:44'
updated_date: '2026-04-24 07:27'
labels:
  - backend
  - albums
  - api
  - download
  - review
dependencies: []
parent_task_id: TASK-053
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

TASK-053.20 needs the frontend to stop buffering the entire album ZIP in memory via `await response.blob()`. The current `GET /api/v1/albums/{id}/download` endpoint requires a bearer `Authorization` header, which an `<a download>` anchor cannot send — that is the only reason the frontend uses `fetch` + `blob`. To enable real browser-native streaming we need an authenticated way to mint a short-lived signed URL that the browser can follow directly.

## Scope

1. Add `POST /api/v1/albums/{id}/download-url` in `AlbumResource`:
   - Requires the normal authenticated user and same authorization as the existing `download` endpoint (album must belong to the current user).
   - Accepts `variant` as query or body param (reuse the existing parser).
   - Returns `{ "url": "...", "expiresAt": "2026-..." }` where `url` is an absolute path (or full URL) to a new unauthenticated streaming endpoint carrying a signed token in the query string.
   - TTL ≤ 5 minutes, single-use if feasible.

2. Add `GET /api/v1/albums/{id}/download-by-token?token=...&variant=...` (or a dedicated path) that:
   - Validates the HMAC-signed token (album id + variant + expiry + uploader), rejects expired/forged tokens with 404.
   - Streams the archive using the existing `albumService.streamArchive(...)` path (do NOT duplicate logic).
   - Responds with `Content-Disposition: attachment; filename*=UTF-8''...`, `Cache-Control: no-store`.

3. HMAC key lives in config (`quarkus.application.signing-key` or similar), generated per install. Document how it is provisioned.

4. Integration tests covering: mint + redeem happy path, expired token → 404, tampered token → 404, cross-user album id in path → 404, variant pass-through.

## Non-goals

- Does not replace the existing authenticated `GET /albums/{id}/download` (keep both for a transition period; FE will migrate).
- Does not introduce a general-purpose signed URL framework — keep it scoped to album archives. Generalize later if we ever need signed photo URLs.

## Why

Unblocks TASK-053.20. Without this endpoint, the only FE alternatives are a Service Worker that injects `Authorization` (complex, cross-browser caveats) or the File System Access API (Chromium-only). A short-lived signed URL is the conventional, simple solution and lets the browser stream natively without JS holding the ZIP in memory.

## Acceptance Criteria
<!-- AC:BEGIN -->
- New endpoints implemented as described; existing endpoint untouched.
- Token-signing uses HMAC with a server-side secret; cannot be forged without the secret.
- Token includes album id + variant + expiry so it cannot be repurposed.
- Expired or tampered tokens return 404 (not a descriptive error — avoids token-existence probing).
- Integration tests cover mint/redeem happy path and all negative paths above.
- Downloaded archive streams to the client without the backend materializing it fully in memory (reuse existing streaming path).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect current album download flow, config patterns, and signing utilities in backend.
2. Add a scoped HMAC-signed album download token service plus config-backed secret handling.
3. Expose authenticated mint endpoint and unauthenticated redeem endpoint that reuse existing archive streaming logic and preserve no-store/content-disposition headers.
4. Cover happy path, expiry, tampering, cross-user/path mismatch, and variant propagation with integration tests.
5. Run spotless and targeted backend tests, then finalize the task in Backlog.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added `AlbumArchiveDownloadTokenService` with HMAC-SHA256 signing over a compact stateless token payload containing album id, owner id, variant, and expiry. `AlbumResource` now exposes authenticated `POST /api/v1/albums/{id}/download-url` and unauthenticated `GET /api/v1/albums/{id}/download-by-token`, both reusing the existing archive streaming response builder and preserving `Cache-Control: no-store` plus UTF-8 `Content-Disposition`. Added config for the signing key/TTL, public route wiring, README documentation, and integration coverage for happy path plus negative validation cases.

Validated with `./gradlew test --tests 'dev.pina.backend.api.AlbumResourceTest'` and `./gradlew spotlessCheck`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented short-lived signed album archive URLs so the frontend can move to browser-native streaming downloads. The backend now mints HMAC-signed download tokens, redeems them through a public no-store streaming endpoint, and covers expiry, tampering, path mismatch, and variant propagation with integration tests.
<!-- SECTION:FINAL_SUMMARY:END -->

- [x] #1 New endpoints are implemented as described while keeping the existing authenticated download endpoint unchanged.
- [x] #2 Token signing uses HMAC with a server-side secret and cannot be forged without the secret.
- [x] #3 The token includes album id, owner id, variant, and expiry so it cannot be repurposed across albums or variants.
- [x] #4 Expired or tampered tokens return 404 without a descriptive token-validation error.
- [x] #5 Integration tests cover mint/redeem happy path, expired token, tampered token, mismatched album path, and variant pass-through.
- [x] #6 Archive downloads still stream through the existing album archive path without materializing the ZIP fully in backend memory.
<!-- AC:END -->
