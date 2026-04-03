---
id: TASK-012
title: REVIEW-002 Rate limiter OOM — add scheduled eviction for stale counters
status: Done
assignee: []
created_date: '2026-04-03 15:30'
updated_date: '2026-04-03 15:39'
labels:
  - backend
  - security
  - performance
milestone: m-2
dependencies: []
references:
  - backend/src/main/java/dev/pina/backend/service/AuthRateLimitService.java
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`AuthRateLimitService` stores rate limit counters in a `ConcurrentHashMap` that grows unboundedly. An attacker spoofing X-Forwarded-For can create millions of entries leading to OOM. Add a scheduled job to evict expired counters, or cap the map size.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Scheduled eviction removes counters older than window-seconds
- [x] #2 Map size stays bounded under high cardinality input
- [x] #3 Rate limiting still functions correctly after eviction
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added `@Scheduled(every = "5m")` eviction of stale counters and `enforceMaxSize()` guard (100K cap) called on every `check()`. Prevents OOM from unbounded ConcurrentHashMap growth under spoofed X-Forwarded-For attacks. All tests pass.
<!-- SECTION:FINAL_SUMMARY:END -->
