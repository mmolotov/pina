---
id: TASK-011
title: >-
  REVIEW-001 CSRF timing attack — replace String.equals() with
  MessageDigest.isEqual()
status: Done
assignee: []
created_date: '2026-04-03 15:30'
updated_date: '2026-04-03 15:39'
labels:
  - backend
  - security
milestone: m-2
dependencies: []
references:
  - backend/src/main/java/dev/pina/backend/service/BrowserSessionService.java
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In `BrowserSessionService.isValidCsrfToken()`, CSRF token comparison uses `String.equals()` which is not constant-time. This makes timing attacks theoretically possible. Replace with `MessageDigest.isEqual()` for constant-time comparison.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 isValidCsrfToken uses MessageDigest.isEqual() for constant-time comparison
- [x] #2 Existing CSRF tests still pass
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced `String.equals()` with `MessageDigest.isEqual()` in `BrowserSessionService.isValidCsrfToken()` for constant-time CSRF token comparison. All tests pass.
<!-- SECTION:FINAL_SUMMARY:END -->
