---
id: TASK-016
title: REVIEW-006 Verify and test CSRF protection on session logout endpoint
status: Done
assignee: []
created_date: '2026-04-03 15:31'
updated_date: '2026-04-03 15:46'
labels:
  - backend
  - security
milestone: m-2
dependencies: []
references:
  - backend/src/main/java/dev/pina/backend/api/AuthResource.java
  - backend/src/main/java/dev/pina/backend/api/BrowserSessionCsrfFilter.java
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The `/session/logout` endpoint is marked `@PermitAll`. When a user is authenticated via session cookie, the BrowserSessionCsrfFilter should enforce CSRF validation on this POST. Verify this works correctly and add a dedicated test — otherwise CSRF logout attacks are possible (attacker forces victim to log out).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Test proves POST /session/logout without CSRF token returns 403 for session-authenticated user
- [x] #2 Test proves POST /session/logout with valid CSRF token succeeds
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added test `sessionLogoutWithoutCsrfTokenIsForbidden` — confirms POST /session/logout without X-CSRF-Token returns 403 and session stays active. Existing test `sessionLogoutRevokesActiveSession` already covers the happy path with valid CSRF token. All tests pass.
<!-- SECTION:FINAL_SUMMARY:END -->
