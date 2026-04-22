---
id: TASK-053.02
title: ALBM-BE-004 Album archive download endpoint
status: To Do
assignee: []
created_date: '2026-04-22 12:14'
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
- [ ] #1 `GET /api/v1/albums/{id}/download` streams a valid zip containing all photos in the album using the `StorageProvider` SPI
- [ ] #2 Ownership check matches existing album endpoints; unauthorized callers receive 404
- [ ] #3 `variant` query param accepts `ORIGINAL` (default) and `COMPRESSED`; invalid values return 400
- [ ] #4 Zip is streamed chunk-wise without buffering entire archive in memory
- [ ] #5 Colliding `original_filename` entries are disambiguated within the zip (no overwritten entries)
- [ ] #6 Integration test downloads an album of several photos and asserts zip entry names and counts
<!-- AC:END -->
