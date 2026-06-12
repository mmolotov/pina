---
id: TASK-050.08
title: ML-SEARCH-001 Expose tag-backed search through /api/v1/search
status: Done
assignee:
  - '@claude'
created_date: '2026-06-11 16:16'
updated_date: '2026-06-12 14:03'
labels:
  - backend
  - ml
  - search
milestone: m-3
dependencies:
  - TASK-050.05
references:
  - backlog/tasks/task-034 - BE-SEARCH-002-Text-and-tag-search-API.md
  - >-
    backlog/tasks/task-050.05 -
    ML-BE-001-Add-backend-ML-orchestration-persistence-and-pgvector-storage.md
documentation:
  - backend/README.md
  - MILESTONES.md
parent_task_id: TASK-050
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the existing search stack so persisted ML auto-tags become searchable through the stable `/api/v1/search` contract, covering the Phase 4 milestone bullet "Search by tags". Current search (TASK-034) matches photo filenames and album names/descriptions only; once TASK-050.05 persists auto-tags, tag matches should become an additional photo-match signal without breaking the existing DTO contract or pagination semantics. Semantic embedding (CLIP text) search stays out of scope — it requires query-time text embeddings via the ML service and lands as follow-up work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Photo results match when the query matches a persisted auto-tag of an accessible photo, in addition to existing filename matching
- [x] #2 Tag matches contribute to relevance scoring with deterministic ordering, and existing filters, sort, and pagination behavior stay unchanged
- [x] #3 Access control for tag-matched results is identical to existing photo search results across library, space, and favorites scopes
- [x] #4 Backend tests cover tag-backed matching, scoring, and authorization paths
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. SearchService photo predicates: extend loadLibraryPhotoMatches and loadSpacePhotoMatches with OR EXISTS (SELECT 1 FROM PhotoTag t WHERE t.photoId = p.id AND LOWER(t.label) LIKE :pattern ESCAPE '!') — tags become an additional match signal through the same access-control joins (library: uploader; spaces: accessible space albums), so visibility semantics are untouched (AC#3).
2. Relevance: batch-load matching tag labels for the result photos (photoId IN :ids AND label LIKE :pattern), score tag matches (exact 100 / prefix 70 / contains 40) and combine with the existing filename score via max — deterministic ordering preserved, filters/sort/pagination code untouched (AC#2).
3. Tests (@QuarkusTest, ML disabled — PhotoTag rows inserted directly): tag-only match returns the photo; exact tag match outranks filename-contains deterministically; other users' tagged photos stay invisible; tag match works for space-album photos for members; existing filename behavior unchanged.
4. Docs: backend/README search section note + CHANGELOG; tick the MILESTONES Phase 4 "Search by tags" bullet when the epic wraps.
Validation: ./gradlew spotlessApply build green.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented as an additional OR EXISTS predicate on PhotoTag inside the existing library/space photo match queries, so all access-control joins stay identical; matching tag labels are batch-loaded for scoring only. Relevance combines via max(filename score, tag score) with tag tiers exact=100 / prefix=70 / contains=40 sitting between the existing filename tiers (120/90/60) — exact tag outranks filename prefix, deterministic ordering preserved; pagination/sort/filter code untouched. Tests insert PhotoTag rows directly (ML disabled in the default test profile), covering tag-only match, ranking vs filename, contains-match, cross-user invisibility, and space-member-only visibility. Semantic (CLIP text) search remains follow-up: EmbedText RPC and pgvector nearest-neighbor query path are already in place from 050.04/050.05.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`/api/v1/search` photo results now match persisted ML auto-tags in addition to filenames, closing the Phase 4 "Search by tags" milestone bullet.

**Matching**: library and space photo queries gained an `OR EXISTS (... PhotoTag ... LIKE :pattern)` predicate using the same escaped LIKE pattern, so tag matches flow through the exact same visibility joins as filename matches — access control is unchanged across all scopes (AC#1, #3).

**Scoring**: matching tag labels are batch-loaded per result set; the photo score becomes max(filename, tag) with tag tiers exact=100/prefix=70/contains=40 interleaved with the filename tiers (120/90/60). An exact tag match deterministically outranks a filename prefix match; sort, filters, pagination, and the DTO contract are untouched (AC#2).

**Tests** (5 new @QuarkusTest with directly inserted PhotoTag rows): tag-only match, exact-tag-vs-filename ranking, contains match, other users' tags invisible, space photos match for members and not outsiders (AC#4). Full backend build green (460 tests, SpotBugs, coverage).

**Docs**: backend README search section rewritten (tags searchable, scoring order, semantic search noted as wired-ready follow-up); CHANGELOG updated. Semantic CLIP text search stays out of scope per the task description — `EmbedText` and the pgvector nearest-neighbor path are already available for that follow-up.
<!-- SECTION:FINAL_SUMMARY:END -->
