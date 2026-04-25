---
id: TASK-055.03
title: ALBM2-FE-003 Albums list header and toolbar copy alignment
status: Done
assignee: []
created_date: '2026-04-25 06:57'
updated_date: '2026-04-25 13:22'
labels:
  - frontend
  - albums
dependencies: []
parent_task_id: TASK-055
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Align the albums list header and toolbar with prototype:

- Page header: large `Альбомы` title + subtitle "{count} альбомов · {totalPhotos} снимков".
- Right side of header: `Новый альбом` primary button.
- Toolbar layout per prototype: scope tabs left → sort `select` → filter input (max 20rem) → view toggle right.
- Use prototype's `.scope-tabs`, `.field`, `.search-field`, `.button-primary` styling.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Albums view header and toolbar visually match the prototype layout
- [x] #2 Subtitle reflects total photos across all albums
- [x] #3 Toolbar reflows correctly on narrow viewports
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Albums view header now renders a 3xl bold "Albums" title with a "{N} albums · {M} photos" subtitle (using formatRelativeCount with the existing unit.album/unit.photo plural forms) and a "+ Create album" primary button on the right. Toolbar moved out of the sticky bar and matches the prototype: scope tabs (.scope-tabs/.scope-tab) → sort select → filter input with leading search icon (Lucide) → tile-style segmented toggle aligned right → columns range slider for non-list styles. The legacy sticky header is preserved for photos/map views.
<!-- SECTION:FINAL_SUMMARY:END -->
