---
id: TASK-053.14
title: TASK-53-BE-REVIEW Trim album-level metadata from public share responses
status: Done
assignee: []
created_date: '2026-04-23 15:05'
updated_date: '2026-04-24 08:55'
labels:
  - backend
  - security
  - privacy
  - review
dependencies: []
references:
  - backend/src/main/java/dev/pina/backend/api/PublicAlbumResource.java
  - backend/src/main/java/dev/pina/backend/api/dto/AlbumDto.java
  - backend/src/test/java/dev/pina/backend/api/AlbumShareLinkResourceTest.java
parent_task_id: TASK-053
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The anonymous public album route still serializes the album payload through `AlbumDto.fromSummary(...)`. That DTO exposes internal identifiers such as `ownerId`, `personalLibraryId`, and `spaceId`, so a share token currently leaks internal metadata even after photo-level fields were trimmed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Public album share responses expose only album fields required by the anonymous consumer flow.
- [x] #2 Internal identifiers such as owner, personal library, and space IDs are removed from the public share contract.
- [x] #3 Integration coverage asserts that the public album payload no longer leaks private/internal album metadata.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Introduced a dedicated `PublicAlbumDto` for anonymous share responses so the public contract no longer reuses the private `AlbumDto` shape with internal owner, library, and space identifiers.

Extended `AlbumShareLinkResourceTest` to assert that the public album payload keeps the required presentation fields while omitting internal album IDs.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Trimmed album-level metadata from anonymous public share responses by replacing the reused private album DTO with a dedicated public DTO. Public album reads now keep only the fields needed by share consumers, and integration coverage verifies that internal owner, library, and space identifiers are absent.
<!-- SECTION:FINAL_SUMMARY:END -->
