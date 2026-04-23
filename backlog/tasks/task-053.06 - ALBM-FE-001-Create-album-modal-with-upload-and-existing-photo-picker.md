---
id: TASK-053.06
title: ALBM-FE-001 Create-album modal with upload and existing-photo picker
status: Done
assignee:
  - '@codex'
created_date: '2026-04-22 12:15'
updated_date: '2026-04-23 13:31'
labels:
  - frontend
  - ux
milestone: m-2
dependencies: []
parent_task_id: TASK-053
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

The current albums tab in `frontend/app/routes/app-library.tsx` shows a large inline "Create album" panel that dominates the above-the-fold area. The redesign replaces it with a compact "Create album" button at the top of the albums view that opens a modal.

## What to build

- A "Create album" button at the top of the albums view (right-aligned with other toolbar controls).
- A modal (use existing UI primitives in `frontend/app/components/ui` if available; otherwise a focused-trap dialog pattern) containing:
  - **Name** (required)
  - **Description** (optional)
  - A section to **add photos** to the new album with two sub-modes:
    - **Upload new**: drag-drop / file picker (JPEG/PNG), reuses the existing `uploadPhoto` flow with a progress indicator.
    - **Pick existing**: a scrollable grid of the user's library photos with multi-select. Filterable by filename.
  - Submit: `POST /albums`, then for each selected / newly-uploaded photo call `POST /albums/{id}/photos/{photoId}`. Show a progress line for the batch.
- On success: close modal, refresh the album grid, navigate to the new album's detail page (see ALBM-FE-004).
- All text must go through the `i18n` dictionary (both `en` and `ru`).
- Replace the existing inline create-album Panel; do not leave both paths live.

## Out of scope

- Sorting / grid tile / detail route — separate tasks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Albums view shows a compact top bar with a "Create album" button; the old inline Panel is removed
- [x] #2 Clicking the button opens an accessible modal (focus trap, Esc to close, focus returns to trigger on close)
- [x] #3 Modal accepts name (required, <=255 chars), description (<=2000 chars), and photo selection via upload or existing-library picker
- [x] #4 Create flow calls `POST /albums` then adds selected/uploaded photos to the new album before closing
- [x] #5 Batch add surfaces per-photo failures without aborting the whole operation; errors are listed to the user
- [x] #6 On success the grid refreshes and the app navigates to the new album's detail route (coordinate with ALBM-FE-004)
- [x] #7 All new copy is translated in both `en` and `ru` dictionaries
- [x] #8 Vitest coverage for modal open/close, validation, and submit path
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the inline create-album panel in the albums view with a compact toolbar button that opens a modal.
2. Reuse the existing upload flow and library-photo data to support creating an album with uploaded files and multi-selected existing photos inside the modal.
3. Submit create first, then batch-add selected photos with partial-failure reporting, refresh albums, and navigate to the new album detail route on success.
4. Add i18n strings and Vitest coverage for modal behavior, validation, and the create flow.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Replaced the albums-view inline create panel with a compact top-bar button that opens a modal dialog and returns focus to the trigger on close.

Implemented a client-side create flow in `app-library` that uploads new files into the personal library, supports multi-select from existing photos, creates the album, and batch-adds selected photo IDs.

Added batch progress and partial-failure handling for album population: the flow continues per photo, lists failures in the modal, and exposes a direct link to the partially created album when some additions fail.

Updated English and Russian copy for the modal workflow and expanded Vitest coverage for modal open/close, validation, upload + existing-photo create flow, and existing album grid/detail regressions.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered `ALBM-FE-001` by replacing the old inline create panel in `app-library` with an accessible create-album modal launched from the albums toolbar. The modal now supports name/description input, drag-drop or file-picker uploads, filterable multi-select from existing library photos, batch album population with per-photo failure reporting, and success navigation to `/app/library/albums/:albumId`. Verified with `npm run typecheck` and `npm run test -- --run app/routes/app-library.test.tsx app/routes/app-album-detail.test.tsx app/routes/app-album-photo-detail.test.tsx app/routes/app-search.test.tsx`.
<!-- SECTION:FINAL_SUMMARY:END -->
