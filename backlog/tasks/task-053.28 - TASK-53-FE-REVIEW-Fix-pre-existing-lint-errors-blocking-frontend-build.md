---
id: TASK-053.28
title: TASK-53-FE-REVIEW Fix pre-existing lint errors blocking frontend build
status: Done
assignee: []
created_date: '2026-04-24 06:49'
updated_date: '2026-04-24 07:35'
labels:
  - frontend
  - lint
  - build
  - review
dependencies: []
parent_task_id: TASK-053
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

`npm run lint --max-warnings=0` fails on the TASK-053 branch because of issues introduced during the epic. Since `npm run build` includes lint, the frontend bundle cannot currently be produced.

## Findings (as of feature/albm-redesign-albums-page HEAD)

1. `app/components/album-share-dialog.tsx:81` — `jsx-a11y/no-noninteractive-element-interactions`. A `<div role="dialog" onKeyDown={trapFocus}>` receives a keyboard listener. Either change the element to a semantically appropriate role or attach the listener to the backdrop/document level.

2. `app/routes/app-album-detail.tsx:478` — `react-hooks/exhaustive-deps` warning. `useEffect` omits `refreshAlbumDetail` from deps. Either add it or stabilize it via `useCallback` with proper deps.

3. `app/routes/app-library.tsx:94` — `@typescript-eslint/no-unused-vars`. `LibraryLoaderData` declared but never used.

4. `app/routes/app-library.tsx:692` — `react-hooks/exhaustive-deps` warning. Destructure specific props before the effect rather than depending on the entire `props` object.

5. `app/routes/app-library.tsx:723` — `jsx-a11y/no-noninteractive-element-interactions`. Non-interactive element with mouse/keyboard listeners.

6. `app/routes/app-library.tsx:1286` — `@typescript-eslint/no-unused-vars`. `albumActionError` is assigned but never read.

## Why

- `npm run build` fails, blocking CI and deploys.
- CLAUDE.md says warnings must fail the build; these are currently blocking and would also fail any downstream reviewer's local check.

## Acceptance Criteria
<!-- AC:BEGIN -->
- `npm run lint --max-warnings=0` passes clean on the branch.
- No regressions in existing component behavior (share dialog keyboard handling, album detail data refresh).
- Each fix keeps the original intent (accessibility behavior, not silencing the rule via lint-disable).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Run the current frontend lint command to capture the exact remaining TASK-053 lint blockers on the branch.
2. Fix the issues without silencing rules: preserve keyboard/accessibility behavior, stabilize effect dependencies, and remove dead code.
3. Add or adjust tests where behavior-sensitive fixes need regression coverage.
4. Re-run lint plus the focused frontend test/typecheck suite.
5. Finalize the task in Backlog with the exact lint command used.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Resolved the remaining TASK-053 frontend lint blockers by removing the unused `fetchApiResponse` helper, deleting the unused `LibraryLoaderData` type, surfacing `albumActionError` in the albums UI, moving dialog focus-trap listeners off JSX non-interactive wrappers into imperative `addEventListener` effects, and stabilizing `refreshAlbumDetail` with `useCallback`. Revalidated the affected routes and API helpers with typecheck and targeted Vitest coverage after the a11y and dependency fixes.

Validated with `npm run lint -- --max-warnings=0`, `npm run typecheck`, and `npm run test -- --run app/lib/api.test.ts app/routes/app-library.test.tsx app/routes/app-album-detail.test.tsx`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Cleared the remaining TASK-053 frontend lint blockers so `npm run lint -- --max-warnings=0` passes again. The fixes preserved dialog keyboard behavior, restored visible album action errors in the UI, and stabilized the album detail refresh effect without muting any lint rules.
<!-- SECTION:FINAL_SUMMARY:END -->

- [x] #1 `npm run lint -- --max-warnings=0` passes clean on the branch.
- [x] #2 No regressions are introduced in existing share-dialog keyboard handling and album detail data refresh behavior.
- [x] #3 Each fix preserves the original behavior and accessibility intent rather than suppressing lint rules.
<!-- AC:END -->
