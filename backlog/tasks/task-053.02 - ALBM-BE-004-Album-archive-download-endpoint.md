---
id: TASK-053.02
title: ALBM-BE-004 Album archive download endpoint
status: Done
assignee: []
created_date: '2026-04-22 12:14'
updated_date: '2026-04-23 11:20'
labels:
  - backend
  - api
dependencies: []
parent_task_id: TASK-053
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

The redesigned album tile exposes a "Download" action. There is no existing download endpoint for bulk photos in the project (verified by grep for `downloadBundle|zip|archive` — no matches).

## What to build

`GET /api/v1/albums/{id}/download` returns a streaming `application/zip` response containing the album's photo originals.

- Auth: same ownership check as other album endpoints.
- Query param `variant` optional, default `ORIGINAL`. Accept `ORIGINAL`, `COMPRESSED`. For videos later this can extend; not in scope now.
- Zip file name: `<album-name-slug>.zip`; entries named `<original_filename>` (de-duplicated with suffixes if collisions).
- Stream using `StreamingOutput` / Mutiny chunks; do not load whole zip into memory. Use `StorageProvider` to read each variant.
- Cancel promptly if the client disconnects.
- Short timeouts and stream-level error handling documented in code (not in a sidecar doc).

## Risks / notes

- Very large albums could take a long time; note in Swagger description that the endpoint streams and may take minutes. No size cap in this task — tracked separately if needed.
- Consider `Content-Disposition: attachment; filename="…"`.

## Out of scope

- Public share links → ALBM-BE-005.
- Client-side download UI → ALBM-FE-005.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `GET /api/v1/albums/{id}/download` streams a valid zip containing all photos in the album using the `StorageProvider` SPI
- [x] #2 Ownership check matches existing album endpoints; unauthorized callers receive 404
- [x] #3 `variant` query param accepts `ORIGINAL` (default) and `COMPRESSED`; invalid values return 400
- [x] #4 Zip is streamed chunk-wise without buffering entire archive in memory
- [x] #5 Colliding `original_filename` entries are disambiguated within the zip (no overwritten entries)
- [x] #6 Integration test downloads an album of several photos and asserts zip entry names and counts
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
`AlbumService.collectArchiveEntries(albumId, variantType)` projects `(storagePath, originalFilename, photoId)` via a single JPQL join over `AlbumPhoto → Photo → PhotoVariant`, filtered by `variantType`, ordered by `ap.addedAt ASC, p.id ASC` for deterministic zip layout. `streamAlbumArchive(entries)` returns a JAX-RS `StreamingOutput` that wraps the response body in a `ZipOutputStream`, iterating entries and streaming each variant via `StorageProvider.retrieve(...).transferTo(zip)` — nothing is buffered between upstream and the socket.

Filename collisions are resolved in memory by a `HashSet<String>` of used names: the first occurrence keeps `originalFilename`; subsequent duplicates become `stem (N).ext` starting from `N=1`. Null/blank `originalFilename` falls back to `photo-<uuid>`.

`GET /api/v1/albums/{id}/download` in `AlbumResource` parses `variant` (default ORIGINAL, accepts ORIGINAL/COMPRESSED, otherwise 400 via `ApiErrors.badRequest`), enforces the same ownership check as the other album endpoints (404 for non-owners), and sets `Content-Disposition: attachment; filename="<slug>.zip"`. `slugifyAlbumName` normalises via `NFKD` → strips combining marks → lowercases → collapses non-alphanumeric to `-` → trims edge dashes, falling back to `album` if empty.

Covered by six new integration tests in `AlbumResourceTest`: happy path (two named photos round-trip through the zip), collision disambiguation (`photo.jpg` + `photo (1).jpg`), `variant=COMPRESSED`, invalid variant → 400, non-owner → 404, empty album → empty zip. Tests decode the response via `ZipInputStream` and compare the set of entry names. 49 tests pass; `spotlessCheck`, `spotbugsMain`, and the full `./gradlew build` are green.
<!-- SECTION:NOTES:END -->
