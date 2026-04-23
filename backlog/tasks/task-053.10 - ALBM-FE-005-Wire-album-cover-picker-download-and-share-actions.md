---
id: TASK-053.10
title: 'ALBM-FE-005 Wire album cover picker, download, and share actions'
status: Done
assignee: []
created_date: '2026-04-22 12:16'
labels:
  - frontend
milestone: m-2
dependencies: []
parent_task_id: TASK-053
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

ALBM-FE-002 and ALBM-FE-004 ship the action surface with download / share / cover placeholders. This task wires them to the real backend once ALBM-BE-003, ALBM-BE-004, and ALBM-BE-005 land.

## What to build

- **Cover picker**: from the album detail page, add "Set as album cover" to each photo's context menu. Call `PUT /albums/{id}/cover`. Clear cover via the edit modal ("Use automatic cover"). Update `listAlbums` response in UI cache or revalidate after mutation.
- **Download**: the Download action triggers `GET /albums/{id}/download` with `variant=ORIGINAL`. Use a hidden `<a>` with `download` attr and `Content-Disposition`-served filename, or `fetch` + `Blob` + `URL.createObjectURL` with a filename derived from the album name. Show a toast on start; handle long downloads (user can navigate away).
- **Share**: replace the interim clipboard-copy fallback from ALBM-FE-002 with a share dialog. Calls `POST /albums/{id}/share-links` to create a public token link, shows the single-use plaintext token once with a copy button; lists existing links with revoke buttons (`DELETE /albums/{id}/share-links/{linkId}`).
- i18n additions for `en` and `ru`.

## Dependencies

- ALBM-BE-003 (cover) → required for cover picker.
- ALBM-BE-004 (download).
- ALBM-BE-005 (share links).
- ALBM-FE-002 (tile action menu).
- ALBM-FE-004 (detail page surfaces these).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Cover picker on the album detail page sets the cover via `PUT /albums/{id}/cover` and the grid reflects the change after revalidation
- [x] #2 Edit modal exposes "Use automatic cover" that calls `DELETE /albums/{id}/cover`
- [x] #3 Download action streams the archive; file name derives from album name; failures surface an inline error
- [x] #4 Share dialog creates a share link via `POST /albums/{id}/share-links`, shows the plaintext token once with a copy button, and lists existing links with a working revoke action
- [x] #5 All new copy translated in `en` and `ru`
- [x] #6 Vitest covers the three action paths with API mocks
<!-- AC:END -->
