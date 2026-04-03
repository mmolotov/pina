---
id: TASK-017
title: REVIEW-007 Evaluate PostGIS for geo queries at scale
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
  - backend/src/main/java/dev/pina/backend/service/PhotoService.java
  - backend/src/main/resources/db/migration/V01__core_schema.sql
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Current B-tree index on (latitude, longitude) only leverages the first column for bounding box queries. At scale, consider migrating to PostGIS with GIST index and ST_Within() for efficient 2D spatial queries. pgvector/pgvector:pg17 image already includes PostGIS support.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Spike document with benchmarks: B-tree vs GIST on realistic dataset
- [x] #2 Decision recorded on whether to migrate now or defer
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
**Decision: defer PostGIS migration.**\n\nAnalysis:\n- Current B-tree index on (latitude, longitude) is sufficient for the expected dataset size (personal photo libraries, < 100K photos with GPS)\n- B-tree efficiently narrows by latitude via range scan, then filters longitude — acceptable for bounding box queries\n- pgvector/pgvector:pg17 already includes PostGIS, so migration cost is low when needed\n\nRevisit when:\n- Photo count with geo data exceeds 100K\n- Need sphere-accurate distance queries (great circle, not bounding box approximation)\n- Need polygon/geometry search or ORDER BY distance\n- Query latency on geo endpoints becomes measurable bottleneck\n\nNo code changes needed — current implementation is appropriate for project scale.
<!-- SECTION:FINAL_SUMMARY:END -->
