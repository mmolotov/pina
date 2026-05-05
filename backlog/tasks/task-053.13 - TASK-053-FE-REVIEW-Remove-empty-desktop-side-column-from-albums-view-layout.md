---
id: TASK-053.13
title: TASK-053-FE-REVIEW Remove empty desktop side column from albums view layout
status: Done
assignee: []
created_date: '2026-04-23 13:39'
labels:
  - frontend
  - review
  - ux
dependencies: []
parent_task_id: TASK-053
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Review finding: the albums view still uses the desktop two-column section layout that was designed for photo/timeline side content. In albums mode the second column is not rendered, but the layout still reserves space for it, unnecessarily shrinking the album grid and leaving whitespace on large screens.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Albums view does not reserve an empty right-side desktop column
- [x] #2 Album grid uses the available horizontal space on desktop layouts
- [x] #3 Other library views keep their current layout behavior
- [x] #4 Vitest or visual assertions cover the albums-view layout branch when appropriate
<!-- AC:END -->
