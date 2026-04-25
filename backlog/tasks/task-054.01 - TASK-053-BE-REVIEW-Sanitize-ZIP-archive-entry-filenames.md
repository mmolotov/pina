---
id: TASK-054.01
title: TASK-053-BE-REVIEW Sanitize ZIP archive entry filenames
status: Done
assignee:
  - codex
created_date: '2026-04-23 12:11'
updated_date: '2026-04-23 12:17'
labels:
  - backend
  - security
  - review
dependencies: []
references:
  - backend/src/main/java/dev/pina/backend/service/AlbumService.java
  - backend/src/main/java/dev/pina/backend/api/AlbumResource.java
parent_task_id: TASK-054
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prevent path traversal in album ZIP exports by ensuring archive entry names derived from uploaded filenames are safe flat basenames before archive generation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ZIP entry names generated for album exports never contain path separators, parent-directory segments, or absolute-path components from uploaded filenames.
- [x] #2 Duplicate exported filenames are still made unique after sanitization.
- [x] #3 Backend tests cover malicious uploaded filenames in archive exports.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect the current ZIP filename resolution path in AlbumService and identify where uploaded names can inject path components.
2. Introduce filename sanitization that collapses incoming names to a safe flat basename before duplicate handling, preserving a usable fallback name when the upload name is blank or sanitizes away.
3. Add regression coverage for archive entries created from malicious filenames and duplicate names after sanitization.
4. Verify the relevant backend tests and record the result in the task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sanitized album archive entry names to safe flat basenames before ZIP generation and preserved duplicate disambiguation after sanitization.

Added archive download regression coverage for path-like uploaded filenames resolving to safe ZIP entry names.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hardened album ZIP export naming so uploaded filenames cannot inject path traversal entries into generated archives. AlbumService now reduces source filenames to safe flat basenames before duplicate resolution, and backend tests cover path-like filenames that previously would have produced unsafe ZIP entries.
<!-- SECTION:FINAL_SUMMARY:END -->
