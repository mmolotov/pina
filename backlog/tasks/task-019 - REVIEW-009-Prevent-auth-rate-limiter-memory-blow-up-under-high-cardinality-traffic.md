---
id: TASK-019
title: >-
  REVIEW-009 Prevent auth rate-limiter memory blow-up under high-cardinality
  traffic
status: Done
assignee: []
created_date: '2026-04-03 16:13'
updated_date: '2026-04-03 16:26'
labels:
  - backend
  - auth
  - security
  - performance
  - review
milestone: m-2
dependencies: []
documentation:
  - backend/src/main/java/dev/pina/backend/service/AuthRateLimitService.java
  - backend/src/main/java/dev/pina/backend/api/AuthRateLimitFilter.java
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The in-memory authentication rate limiter does not enforce a real hard cap on counter growth. Under high-cardinality traffic it can keep accepting new keys within the active window and grow the ConcurrentHashMap without bound, creating heap pressure and potential DoS risk.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Rate limiting enforces a bounded memory footprint even under high-cardinality traffic
- [x] #2 New unique keys cannot grow in-memory counters without limit within a single active window
- [x] #3 Automated tests cover the bounded-growth behavior
<!-- AC:END -->
