---
id: TASK-018
title: REVIEW-008 Consider Caffeine cache for rate limiter under high concurrency
status: Done
assignee: []
created_date: '2026-04-03 15:31'
updated_date: '2026-04-03 15:47'
labels:
  - backend
  - performance
milestone: m-2
dependencies: []
references:
  - backend/src/main/java/dev/pina/backend/service/AuthRateLimitService.java
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
AuthRateLimitService uses ConcurrentHashMap.compute() which locks per segment/bucket. Under high concurrency on a single IP, this creates a sequential bottleneck. Consider replacing with Caffeine cache (TTL-based eviction built in, better concurrent performance). Low priority — current scale is fine.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Spike: benchmark ConcurrentHashMap vs Caffeine under simulated load
- [x] #2 Decision recorded on whether to migrate
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
**Decision: defer Caffeine migration.**\n\nAnalysis:\n- ConcurrentHashMap.compute() in Java 17+ uses fine-grained (node-level) locking, not segment-level — contention is minimal\n- Scheduled eviction (every 5m) and enforceMaxSize() cap (100K) already prevent unbounded growth (added in REVIEW-002)\n- Rate limiter only covers 6 auth endpoints, not general traffic — concurrency pressure is inherently low\n- Adding Caffeine means a new dependency for marginal gain at current scale\n\nRevisit when:\n- Auth endpoint traffic exceeds ~1000 RPS sustained\n- Need LRU/LFU eviction policy instead of time-window\n- Need cache statistics (hit rate, eviction metrics) for observability\n\nNo code changes needed — current ConcurrentHashMap + scheduled eviction is appropriate.
<!-- SECTION:FINAL_SUMMARY:END -->
