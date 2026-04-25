---
id: TASK-053.22
title: TASK-53-BE-REVIEW Preserve non-ASCII album names in download filenames
status: Done
assignee: []
created_date: '2026-04-24 05:30'
updated_date: '2026-04-24 07:21'
labels:
  - backend
  - ux
  - i18n
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
`AlbumResource.slugifyAlbumName` NFKD-strips diacritics and then replaces any non-`[a-z0-9]` character with `-`. An album named "Семейные фото" downloads as `album.zip` and "Voyage été" as `voyage-ete.zip`. Cyrillic/CJK/emoji album names lose all user-recognizable content. The HTTP contract supports UTF-8 filenames via RFC 5987 (`filename*=UTF-8''...`) and modern browsers prefer that parameter over the ASCII fallback.

Acceptance Criteria:
- Downloaded album archives keep the original album name (subject to path-safety stripping) in the saved filename when the browser supports RFC 5987.
- An ASCII fallback remains present via `filename=` for legacy clients.
- Test coverage asserts both the UTF-8 and ASCII parameters on `Content-Disposition` for a non-ASCII album name.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Downloaded album archives keep the original album name (subject to path-safety stripping) in the saved filename when the browser supports RFC 5987.
- [x] #2 An ASCII fallback remains present via `filename=` for legacy clients.
- [x] #3 Test coverage asserts both the UTF-8 and ASCII parameters on `Content-Disposition` for a non-ASCII album name.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated `AlbumResource.download` to emit a dual-parameter `Content-Disposition` header with both an ASCII fallback filename and an RFC 5987 UTF-8 filename. Added sanitization for the UTF-8 filename to strip path separators and control characters while preserving recognizable album names. Covered the behavior with an integration test that asserts both `filename=` and `filename*=` for a Cyrillic album name.

Validated with `./gradlew test --tests 'dev.pina.backend.api.AlbumResourceTest'` and `./gradlew spotlessCheck`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Preserved non-ASCII album names in album archive downloads by sending `Content-Disposition` with both ASCII fallback and UTF-8 `filename*` parameters. Added integration coverage for a Cyrillic album name and kept path-safety sanitization in place.
<!-- SECTION:FINAL_SUMMARY:END -->
