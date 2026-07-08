---
id: TASK-062
title: 'Comprehensive project review: fix found defects and close test gaps'
status: Done
assignee:
  - '@claude'
created_date: '2026-07-08 08:03'
updated_date: '2026-07-08 08:58'
labels:
  - review
  - tests
  - backend
  - frontend
  - ml
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Perform a cross-cutting review of backend (Quarkus), frontend (React Router 7 SPA), and ML service (Python/gRPC). Identify functional defects, security weaknesses, and concurrency issues; fix the problematic spots found during review and add the missing unit/integration/e2e tests that would have caught them. Focus areas: auth/session/CSRF surfaces, Spaces RBAC and invite links, album share links and public access, upload pipeline and storage path safety, trash/purge lifecycle, admin endpoints, and frontend route loaders/actions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review findings are documented (what was checked, what was found, what was fixed vs deferred)
- [x] #2 Each fixed defect is covered by a new or extended automated test that fails before the fix
- [x] #3 Identified test-coverage gaps in backend/frontend/ml are closed or explicitly deferred with reasoning
- [x] #4 Full backend test suite passes (./gradlew test)
- [x] #5 Frontend npm run check and npm run test pass
- [x] #6 ML make lint and make test pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Review findings (full pass over backend services/resources, frontend libs/routes, ml service)

**Defects to fix now**
1. BE: Re-uploading a photo that sits in the trash returns HTTP 500. `PhotoService.upload` dedup lookup uses the entity mapping (`@SQLRestriction("deleted_at is null")`) so a trashed duplicate is invisible, but `idx_photos_uploader_content_hash` is a full unique index → insert collides; the PersistenceException recovery re-reads through the same restriction, finds nothing, rethrows. Fix: native trashed-duplicate lookup + restore (deleted_at = NULL) on re-upload, in both the fast path and the persist-collision recovery.
2. BE: purge/restore TOCTOU — `PhotoService.purge`/`AlbumService.purge` delete by pre-collected ids without re-checking `deleted_at IS NOT NULL`; a concurrent restore (Trash restore or the new re-upload restore) can have its row hard-deleted and storage files removed. Fix: lock rows FOR UPDATE and only purge still-trashed ids; collect storage paths from the locked set.
3. BE: photos restored from trash can be stuck with a terminally FAILED analysis job ("photo no longer exists") if they were trashed before the ML worker ran; restore never re-queues. Fix: `MlAnalysisService.ensureQueuedForRestoredPhotos` (upsert PENDING where FAILED / missing) called from TrashService.restore and the re-upload restore path.
4. FE: timeline is timezone-dependent — `formatDayLabel`, `buildProportionalTimeline` (local `getFullYear`/`getMonth` + labels without timeZone) and `dateAtPosition` shift one day/month west of UTC (formatZoomGroupLabel already does it right). Fix: derive year/month from the dayKey string and format via Intl with timeZone: "UTC".
5. BE hardening: `AuthService.authenticate` returns early for unknown usernames (bcrypt timing oracle → username enumeration). Fix: dummy bcrypt verify on the missing-account path.

**Test gaps to close**
- BE: integration test upload → trash → re-upload (fails before fix 1), purge skips-live-rows test, restore requeues FAILED analysis job.
- FE unit tests for untested libs: timeline.ts (grouping/zoom/rail/proportional markers/dateAtPosition + TZ regression), photo-media.ts, admin-format.ts, album-view-prefs.ts, errors.ts.
- E2E: add only if Playwright browsers available locally.

**Noted, deliberately not changed** (design decisions / follow-ups): public share links intentionally expose ORIGINAL variant (frontend uses it); personal /albums/{id} endpoints accept space albums for their owner (share/download for space albums only reachable that way); trashed space albums are invisible in trash UI but auto-purge after retention; RegistrationMode.INVITE_ONLY currently behaves as CLOSED (no invite-code registration path yet); SearchService paginates in memory.

**Verification**: ./gradlew spotlessApply test; frontend npm run check + npm run test; ml make lint + make test (already green baseline).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed and verified fail→pass: (1) re-upload of trashed content now restores the photo — PhotoService.restoreTrashedDuplicate in fast path + persist-collision recovery; new PhotoUploadTrashRestoreTest reproduced the unique-index 500 before the fix. (2) purge TOCTOU: PhotoService.purge/AlbumService.purge lock rows FOR UPDATE and only delete still-trashed ids; TrashServiceTest.purgeSkipsRowsThatAreNoLongerTrashed. (3) MlAnalysisService.requeueRestoredPhotos resets FAILED jobs (or inserts missing) on restore, wired into TrashService.restore (after-commit poke) and the re-upload restore; covered in both test paths. (4) AuthService.authenticate burns a dummy bcrypt for unknown usernames and moves the active check after password verification (timing oracle). (5) Frontend timeline.ts was timezone-dependent (formatDayLabel/buildProportionalTimeline/dateAtPosition used local-time getters); now string-parsed calendar parts + Intl timeZone:UTC; timeline.test.ts pins TZ=America/Anchorage and failed 4 tests pre-fix. (6) Anonymous deep links to /app/* landed in the root error boundary (child clientLoader 401 wins over render guard); added session guard clientLoader to app-layout that throws redirect to /login?redirect=…; new e2e auth-and-public-album.spec.ts failed 3/3 pre-fix, 9/9 post-fix.

Also made auth test classes re-runnable against the persistent dev database pinned by backend/.env (AuthServiceTest, AuthResourceTest, AuthResourceGoogleTest used fixed usernames/emails and failed on second run with 409/UsernameAlreadyExists). New frontend unit tests: timeline (16), photo-media (7), admin-format (9), album-view-prefs (7), errors (3). Local env note: backend tests require the pina-dev-pg container running (started it via docker start).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Comprehensive review: 6 defects fixed, test gaps closed across BE/FE/e2e

**Reviewed**: backend auth stack (JWT/refresh/browser sessions/CSRF/rate limit), Spaces RBAC + invite links, album share links + public access + archive download tokens, upload pipeline + storage path safety, trash/purge lifecycle, ML orchestration/clustering, admin services; frontend libs and route loaders; ML service (gRPC server, downloads, registry).

**Fixed (each with a test that failed before the fix where reproducible):**
1. **Re-upload of a trashed photo returned HTTP 500** — dedup lookup is hidden by `@SQLRestriction` while the full unique index `(uploader_id, content_hash)` still holds the trashed row. Upload now restores the trashed duplicate (fast path + persist-collision recovery). `PhotoUploadTrashRestoreTest` (3 tests; 2 reproduced the ConstraintViolation pre-fix).
2. **Purge/restore TOCTOU** — `PhotoService.purge`/`AlbumService.purge` now lock rows `FOR UPDATE` and delete only still-trashed ids, so a concurrent restore can't lose its row/storage; live rows are untouched (`purgeSkipsRowsThatAreNoLongerTrashed`).
3. **Restored photos stuck with FAILED analysis jobs** — `MlAnalysisService.requeueRestoredPhotos` resets FAILED jobs (or inserts missing) inside the restore transaction; wired into `TrashService.restore` (+ after-commit poke) and the re-upload restore. Covered in both paths.
4. **Username-enumeration timing oracle** — `AuthService.authenticate` burns a dummy bcrypt for unknown usernames; active check moved after password verification.
5. **Timeline was timezone-dependent** — `formatDayLabel`, `buildProportionalTimeline`, `dateAtPosition` shifted a day/month/year back for viewers west of UTC. Calendar parts now parsed from the dayKey string; Intl formats pinned to UTC. `timeline.test.ts` runs its worker under `TZ=America/Anchorage` (4 tests failed pre-fix).
6. **Anonymous deep links to /app/\* showed the root error page instead of login** — child clientLoader 401s beat the render guard. Added a session-guard `clientLoader` on `app-layout` that throws `redirect("/login?redirect=…")`. New e2e failed 3/3 pre-fix, passes 9/9.

Also: made `AuthServiceTest`/`AuthResourceTest`/`AuthResourceGoogleTest` re-runnable against the persistent dev DB pinned by `backend/.env` (fixed usernames/emails conflicted on second run — 23 failures on a full local rerun before this change).

**New tests**: backend `PhotoUploadTrashRestoreTest` + 3 tests in `TrashServiceTest`; frontend unit `timeline` (16), `photo-media` (7), `admin-format` (9), `album-view-prefs` (7), `errors` (3); e2e `auth-and-public-album.spec.ts` (auth guard redirect, public share album render, invalid token fallback × 3 viewports).

**Verification**: backend `./gradlew test` 497/0/0; frontend `npm run check` OK, vitest 216/216, Playwright 18/18 (responsive screenshots unchanged); ML `make lint` + 28/28, coverage 87%.

**Deferred (documented in plan)**: public ORIGINAL variant on share links is intended product behavior; personal `/albums/{id}` endpoints accept owner's space albums (only path to share/download them); trashed space albums invisible in trash but auto-purged; `INVITE_ONLY` currently equals `CLOSED` (no invite-code registration yet); SearchService in-memory pagination.
<!-- SECTION:FINAL_SUMMARY:END -->
