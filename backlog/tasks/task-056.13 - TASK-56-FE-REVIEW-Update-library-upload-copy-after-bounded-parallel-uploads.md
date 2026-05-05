---
id: TASK-056.13
title: TASK-56-FE-REVIEW Update library upload copy after bounded parallel uploads
status: Done
assignee:
  - '@maksim'
created_date: '2026-04-30 08:29'
updated_date: '2026-04-30 08:32'
labels:
  - review
  - frontend
  - TASK-056
dependencies: []
references:
  - frontend/app/lib/i18n.tsx
parent_task_id: TASK-056
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The library dropzone copy still says the frontend uploads files sequentially, but TASK-056.01 and TASK-056.10 changed the behavior to bounded parallel upload batches. This makes the user-facing documentation/copy stale and contradicts the implemented upload pipeline.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 English library dropzone description no longer claims uploads are sequential.
- [x] #2 Russian library dropzone description no longer claims uploads are sequential.
- [x] #3 Updated copy reflects bounded batch uploads without exposing implementation details that users do not need.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update the library dropzone copy in English and Russian so it no longer describes uploads as sequential.
2. Verify the stale wording is gone from the frontend copy.
3. Mark acceptance criteria complete and close the task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated `frontend/app/lib/i18n.tsx` library dropzone descriptions in English and Russian so they no longer claim uploads are sequential. Verified the old sequential wording is no longer present in the frontend upload copy. Ran `npm run typecheck` successfully.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated the library upload copy to match the bounded parallel batch upload behavior. English and Russian descriptions now say the app uploads several files at a time and refreshes the library after the batch completes. Verification: `rg` for the stale sequential wording returned no matches; `npm run typecheck` passed.
<!-- SECTION:FINAL_SUMMARY:END -->
