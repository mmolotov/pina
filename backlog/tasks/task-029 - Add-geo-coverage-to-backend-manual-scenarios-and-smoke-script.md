---
id: TASK-029
title: Add geo coverage to backend manual scenarios and smoke script
status: Done
assignee:
  - codex
created_date: '2026-04-03 17:02'
updated_date: '2026-04-03 17:08'
labels:
  - backend
  - tests
  - docs
milestone: m-2
dependencies: []
documentation:
  - backend/docs/api-manual-test-scenarios.md
  - backend/scripts/manual-smoke.sh
  - backend/README.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the backend manual API scenarios document and the local smoke script so geo-tagged photo flows are covered alongside the existing non-admin backend surface. The work should stay aligned with the current personal-library geo endpoints and remain independent from future admin APIs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The manual scenarios document includes clear geo test steps for bounding-box and nearby photo queries using the current personal-library geo endpoints
- [x] #2 The smoke script exercises geo-tagged photo upload plus successful geo query assertions against `/api/v1/photos/geo` and `/api/v1/photos/geo/nearby`
- [x] #3 The smoke flow remains self-contained for local execution and does not require undocumented external setup beyond the documented prerequisites
- [x] #4 The updated smoke script is run successfully against a local backend and the result is recorded
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a self-contained geo-tagged photo fixture flow to backend/scripts/manual-smoke.sh so the script can upload photos with GPS EXIF and assert both bounding-box and nearby geo endpoints without extra undocumented setup.
2. Update backend/docs/api-manual-test-scenarios.md to document the geo upload preconditions and the new manual scenarios for /api/v1/photos/geo and /api/v1/photos/geo/nearby.
3. Run syntax checks as needed, start the local backend, execute the updated smoke script end-to-end, and record the outcome in the task notes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-04-03: Added self-contained GPS EXIF JPEG fixtures to backend/scripts/manual-smoke.sh so geo coverage does not require external sample files or extra local tooling.

2026-04-03: Added manual geo walkthrough steps for bounding-box and nearby personal-library queries to backend/docs/api-manual-test-scenarios.md.

2026-04-03: Ran backend/scripts/manual-smoke.sh successfully against a local quarkusDev backend. In the Codex sandbox this required an escalated execution because localhost access from the smoke command was blocked by sandbox policy.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Extended the backend manual API documentation with a geo walkthrough covering geo-tagged photo upload, bounding-box queries, and nearby queries for the personal-library endpoints. Updated the local smoke script to generate embedded GPS EXIF JPEG fixtures, assert geo upload coordinates, and verify both `/api/v1/photos/geo` and `/api/v1/photos/geo/nearby` as part of the existing non-admin smoke flow. Verified the full smoke run successfully against a local quarkusDev backend.
<!-- SECTION:FINAL_SUMMARY:END -->
