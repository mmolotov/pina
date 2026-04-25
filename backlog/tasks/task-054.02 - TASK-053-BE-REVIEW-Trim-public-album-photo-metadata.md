---
id: TASK-054.02
title: TASK-053-BE-REVIEW Trim public album photo metadata
status: Done
assignee:
  - codex
created_date: '2026-04-23 12:12'
updated_date: '2026-04-23 12:17'
labels:
  - backend
  - security
  - privacy
  - review
dependencies: []
references:
  - backend/src/main/java/dev/pina/backend/api/PublicAlbumResource.java
  - backend/src/main/java/dev/pina/backend/api/dto/PhotoDto.java
  - backend/src/test/java/dev/pina/backend/api/AlbumShareLinkResourceTest.java
parent_task_id: TASK-054
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Limit anonymous public album responses to photo metadata that is safe for share-link consumers and avoid exposing internal identifiers or sensitive EXIF/GPS details.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Public share album responses no longer expose EXIF payloads, GPS coordinates, uploader identifiers, or personal library identifiers.
- [x] #2 The response still contains the metadata needed by the public album UI to render photo lists.
- [x] #3 Backend tests verify that sensitive fields are absent from public share responses.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define a public-share photo DTO containing only fields required by the anonymous album experience.
2. Update PublicAlbumResource to serialize public album photos through the trimmed DTO instead of the private PhotoDto.
3. Add integration assertions proving EXIF, GPS, uploader, and personal-library fields are absent while required presentation fields remain available.
4. Verify the related backend tests and record the result in the task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Introduced a dedicated PublicPhotoDto for anonymous share responses so only presentation-safe photo metadata is serialized.

Extended public share integration coverage to assert EXIF, GPS, uploader, and personal-library fields are absent while required photo fields remain present.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Trimmed the anonymous public album response contract by introducing a dedicated public photo DTO. Public share metadata now omits EXIF payloads, GPS coordinates, uploader identifiers, and personal library identifiers, with integration coverage verifying the reduced payload still serves the public album UI.
<!-- SECTION:FINAL_SUMMARY:END -->
