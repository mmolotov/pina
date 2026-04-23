---
id: TASK-054
title: TASK-053-BE-REVIEW Harden public share and archive export security
status: Done
assignee:
  - codex
created_date: '2026-04-23 12:11'
updated_date: '2026-04-23 12:32'
labels:
  - backend
  - security
  - review
dependencies: []
references:
  - backend/src/main/java/dev/pina/backend/api/PublicAlbumResource.java
  - backend/src/main/java/dev/pina/backend/service/AlbumService.java
  - backend/src/test/java/dev/pina/backend/api/AlbumShareLinkResourceTest.java
documentation:
  - README.md
  - backend/README.md
  - docs/product-requirements.adoc
  - docs/adr.adoc
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Address backend review findings in public album sharing and ZIP export so anonymous share access does not leak private metadata, remains immediately revocable, and generated archives are safe to extract. Scope is limited to the review defects in public share metadata/file delivery and album archive generation, with regression coverage in backend tests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Album archive ZIP entry names are reduced to safe flat filenames before de-duplication and archive generation.
- [x] #2 Anonymous public album metadata responses exclude private/internal photo metadata that is not intended for share-link consumers.
- [x] #3 Token-based public share metadata and file responses disable storage in caches so revoked or expired links cannot be replayed from caches.
- [x] #4 Public share variant parsing is locale-safe and matches authenticated album download behavior.
- [x] #5 Backend automated tests cover the review regressions for ZIP names, public metadata exposure, cache headers, and variant parsing.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update the public album API contract to return a share-safe photo DTO, add cache-control headers on token-based metadata and file responses, and align variant parsing with the locale-safe logic used by authenticated downloads.
2. Harden album ZIP export naming by normalizing uploaded filenames to safe flat basenames before duplicate resolution and preserve deterministic uniqueness for repeated names.
3. Extend backend integration and service-level tests to cover sensitive-field omission, no-store headers, locale-safe variant parsing, and malicious archive filenames.
4. Run the focused backend test suite for album share links and related archive behavior, then update acceptance criteria and implementation notes with the verified outcomes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the full review fix set across PublicAlbumResource, a dedicated PublicPhotoDto, AlbumService ZIP naming, and backend regression tests.

Verified the change set with ./gradlew spotlessCheck test --tests 'dev.pina.backend.api.AlbumShareLinkResourceTest' --tests 'dev.pina.backend.api.AlbumResourceTest'.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the backend review fixes for public album sharing and ZIP export security. The public share API now returns a trimmed photo DTO, adds Cache-Control: no-store to token-based metadata and file responses, and parses variants with Locale.ROOT; ZIP exports now sanitize uploaded filenames to safe flat basenames before duplicate resolution. Regression coverage was added in AlbumShareLinkResourceTest and AlbumResourceTest, and the focused backend verification command passed after spotless formatting.
<!-- SECTION:FINAL_SUMMARY:END -->
