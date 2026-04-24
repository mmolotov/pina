---
id: TASK-053.25
title: TASK-53-FE-REVIEW Pin AlbumShareDialog Escape handler to stable deps
status: Done
assignee: []
created_date: '2026-04-24 05:30'
updated_date: '2026-04-24 07:39'
labels:
  - frontend
  - review
dependencies: []
references:
  - frontend/app/components/album-share-dialog.tsx
parent_task_id: TASK-053
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`AlbumShareDialog` wires a `keydown` listener for Escape with `[props]` as the dependency array. Because the parent passes a new props object on every render, the listener is removed and reattached on every parent re-render (and a keystroke landing between the `removeEventListener` and `addEventListener` call would be dropped silently). The dependency should be narrowed to `props.onClose` (and the handler should close over the latest value via a ref if the parent passes a new function identity every render).

Acceptance Criteria:
- The Escape-key listener is attached once per open dialog lifetime and removed once on close or unmount.
- Rapid parent re-renders do not cause repeated add/remove cycles.
- Behavior is covered by a component test that presses Escape after several parent re-renders.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Escape-key listener is attached once per open dialog lifetime and removed once on close or unmount.
- [x] #2 Rapid parent re-renders do not cause repeated add/remove cycles for the Escape listener.
- [x] #3 Behavior is covered by a component test that presses Escape after several parent re-renders and confirms the latest close callback is used.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Re-check `AlbumShareDialog` Escape-key listener wiring after the recent dialog cleanup changes to confirm whether code changes are still needed.
2. If necessary, narrow dependencies further so the Escape listener attaches once per dialog lifetime and reads the latest close callback through a ref.
3. Add a focused component test that re-renders the dialog multiple times and verifies Escape still closes it without repeated listener churn.
4. Re-run the targeted dialog/component tests plus lint/typecheck if code changes are required.
5. Finalize the task in Backlog with what changed and what was validated.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Re-verified that `AlbumShareDialog` already uses a stable `document` Escape listener with an empty dependency array and routes the latest `onClose` callback through `onCloseRef`. Added `album-share-dialog.test.tsx` to re-render the dialog multiple times with new close callbacks, assert that the keydown listener is attached only once before unmount, and confirm Escape invokes only the latest callback before the listener is removed on unmount.

Validated with `npm run test -- --run app/components/album-share-dialog.test.tsx`, `npm run lint -- --max-warnings=0`, and `npm run typecheck`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Confirmed the AlbumShareDialog Escape handler is pinned to stable deps and added focused component coverage for repeated parent rerenders. The dialog now has an explicit regression test that proves listener stability and latest-callback behavior.
<!-- SECTION:FINAL_SUMMARY:END -->
