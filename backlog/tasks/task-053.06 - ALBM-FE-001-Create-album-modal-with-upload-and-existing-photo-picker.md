---
id: TASK-053.06
title: ALBM-FE-001 Create-album modal with upload and existing-photo picker
status: To Do
assignee: []
created_date: '2026-04-22 12:15'
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
- [ ] #1 Albums view shows a compact top bar with a "Create album" button; the old inline Panel is removed
- [ ] #2 Clicking the button opens an accessible modal (focus trap, Esc to close, focus returns to trigger on close)
- [ ] #3 Modal accepts name (required, <=255 chars), description (<=2000 chars), and photo selection via upload or existing-library picker
- [ ] #4 Create flow calls `POST /albums` then adds selected/uploaded photos to the new album before closing
- [ ] #5 Batch add surfaces per-photo failures without aborting the whole operation; errors are listed to the user
- [ ] #6 On success the grid refreshes and the app navigates to the new album's detail route (coordinate with ALBM-FE-004)
- [ ] #7 All new copy is translated in both `en` and `ru` dictionaries
- [ ] #8 Vitest coverage for modal open/close, validation, and submit path
<!-- AC:END -->
