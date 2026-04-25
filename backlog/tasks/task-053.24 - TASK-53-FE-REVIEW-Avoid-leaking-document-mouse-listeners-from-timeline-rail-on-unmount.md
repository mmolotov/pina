---
id: TASK-053.24
title: >-
  TASK-53-FE-REVIEW Avoid leaking document mouse listeners from timeline rail on
  unmount
status: Done
assignee: []
created_date: '2026-04-24 05:30'
updated_date: '2026-04-24 07:37'
labels:
  - frontend
  - memory
  - review
dependencies: []
references:
  - frontend/app/components/proportional-timeline-rail.tsx
parent_task_id: TASK-053
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`ProportionalTimelineRail.handleMouseDown` attaches `mousemove` and `mouseup` listeners to `document` via inner closures and only removes them inside the `mouseup` handler. If the component unmounts (e.g. navigating away) while a drag is active, those listeners stay attached and continue to invoke `setHoverState` / `setIsDragging` on the unmounted component until the next global mouseup. Besides the transient React warning, the closures retain references to the unmounted component's props until garbage collected.

Acceptance Criteria:
- Starting a drag and then unmounting the rail (e.g. route change) removes the document-level listeners as part of cleanup.
- No "state update on unmounted component" warnings occur in that scenario.
- Existing timeline tests or a small follow-up test covers the unmount path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Starting a drag and then unmounting the rail removes the document-level listeners as part of cleanup.
- [x] #2 No state-update-on-unmounted-component warnings occur when the rail is unmounted during an active drag.
- [x] #3 A focused component test covers the unmount-while-dragging path.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect `ProportionalTimelineRail` drag lifecycle to see how document-level listeners are registered and cleaned up today.
2. Refactor the drag listener management so the active document listeners are tracked in refs and always removed on unmount, not only on mouseup.
3. Add a focused component test that starts a drag, unmounts the rail, and verifies cleanup without leaking document listeners.
4. Re-run the relevant frontend tests plus lint/typecheck if the change touches shared patterns.
5. Finalize the task in Backlog with the cleanup strategy and validations.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Refactored `ProportionalTimelineRail` to keep only bare listener-detach logic in a ref, so unmount cleanup removes `mousemove`/`mouseup` listeners without calling `setIsDragging` during teardown. Added `proportional-timeline-rail.test.tsx` to start a drag, unmount the component, and verify that the exact document listeners registered for the drag are removed and do not emit console errors after unmount.

Validated with `npm run test -- --run app/components/proportional-timeline-rail.test.tsx`, `npm run lint -- --max-warnings=0`, and `npm run typecheck`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed the timeline rail drag cleanup so unmounting during an active drag detaches document listeners without performing state updates during teardown. Added focused component coverage for the unmount path.
<!-- SECTION:FINAL_SUMMARY:END -->
