---
id: TASK-053.23
title: TASK-53-BE-REVIEW Disable caching on authenticated album archive downloads
status: Done
assignee: []
created_date: '2026-04-24 05:30'
updated_date: '2026-04-24 09:13'
labels:
  - backend
  - privacy
  - review
dependencies: []
references:
  - backend/src/main/java/dev/pina/backend/api/AlbumResource.java
  - backend/src/test/java/dev/pina/backend/api/AlbumResourceTest.java
parent_task_id: TASK-053
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`GET /api/v1/albums/{id}/download` serves a streaming ZIP of the album contents to the authenticated owner but sets no `Cache-Control` header. TASK-054.03 already switched token-based public responses to `Cache-Control: no-store` to prevent replays; the authenticated archive path carries comparable content sensitivity (original photos) and should not be cached by intermediaries or the browser's disk cache either.

Acceptance Criteria:
- [x] Authenticated album archive downloads respond with `Cache-Control: no-store` (and matching `Pragma`/`Expires` as appropriate).
- [x] The change is covered by a backend test that asserts the header on a successful download and a 400 for invalid variants.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added `Cache-Control: no-store`, `Pragma: no-cache`, and `Expires: 0` to authenticated album archive downloads in `AlbumResource`.

Extended the happy-path archive download integration test to assert the non-cacheable response headers while keeping the invalid-variant 400 coverage intact.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hardened authenticated album archive downloads against browser and intermediary caching by marking successful ZIP responses as non-cacheable. Backend coverage now locks the expected cache headers on successful downloads and keeps variant validation behavior under test.
<!-- SECTION:FINAL_SUMMARY:END -->
