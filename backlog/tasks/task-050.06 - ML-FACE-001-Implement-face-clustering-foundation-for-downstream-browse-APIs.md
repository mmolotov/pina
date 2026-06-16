---
id: TASK-050.06
title: ML-FACE-001 Implement face clustering foundation for downstream browse APIs
status: Done
assignee:
  - '@claude'
created_date: '2026-04-20 13:55'
updated_date: '2026-06-12 13:52'
labels:
  - backend
  - ml
  - faces
milestone: m-3
dependencies:
  - TASK-050.05
references:
  - >-
    backlog/tasks/task-035 -
    BE-SEARCH-003-Face-cluster-browse-and-management-APIs.md
  - >-
    backlog/tasks/task-049 -
    ML-PLAN-001-Define-Phase-4-ML-service-delivery-plan.md
documentation:
  - docs/product-requirements.adoc
  - backend/README.md
  - MILESTONES.md
parent_task_id: TASK-050
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the backend-side face clustering foundation that groups persisted face descriptors into stable clusters for later browsing and naming. This task should focus on the data model and clustering behavior needed to support downstream face APIs, rather than on the final API surface itself.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Persisted face descriptors can be grouped into stable cluster records with deterministic identity or merge rules appropriate for incremental ingestion
- [x] #2 The clustering approach supports adding newly analyzed photos without requiring a full rebuild for routine ingestion
- [x] #3 The resulting data model is compatible with the browse, naming, and merge flows expected by `TASK-035` without a later schema redesign
- [x] #4 Tests cover cluster assignment behavior and at least the core invariants needed to avoid unsafe merge or split outcomes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Migration V03__face_clusters.sql: face_clusters (id, owner_id FK users cascade, nullable name for TASK-035 naming, centroid vector(512), centroid_weight int — running count of absorbed descriptors, timestamps, owner index); photo_faces.cluster_id UUID FK face_clusters ON DELETE SET NULL + index. Clusters are owner-scoped (photo uploader): personal-library-first privacy model; Space-level grouping stays follow-up.
2. Entity FaceCluster (hibernate-vector centroid float[]); PhotoFace.clusterId column added.
3. FaceClusterService — incremental nearest-centroid assignment, deterministic by construction: runs inside the ML persist transaction right after photo_faces insert, processing faces in response order; per-owner advisory lock via existing TransactionalLockService serializes concurrent assignments; for each descriptor find nearest owner cluster by pgvector cosine distance (centroid <=> CAST(:d AS vector) LIMIT 1); distance <= pina.ml.face-cluster-distance (new MlConfig knob, default 0.6 ≈ cosine sim 0.4 for ArcFace) → assign + update centroid incrementally normalize((centroid*weight + d)/(weight+1)), weight++; otherwise create a new cluster seeded with the descriptor. No implicit cluster merging — merge/split are explicit TASK-035 user operations. Faces without descriptors stay unassigned.
4. Wiring: MlAnalysisService.persistResults passes the freshly inserted faces (with owner id) to FaceClusterService in the same transaction, so cluster assignment is atomic with face persistence and re-analysis (replace faces → reassign) converges; photo deletion cascades faces, clusters keep monotonic centroid_weight (browse counts are derived per query, empty clusters filtered downstream — noted for TASK-035).
5. Tests (@QuarkusTest reusing the FakeMlProfile + fake @GrpcService with a new scripted faces builder): same descriptor across two photos → one cluster, weight 2; two orthogonal faces in one photo → two clusters; near-duplicate (cos 0.8) joins existing cluster without rebuild (AC#2); orthogonal vector (cos 0) never merges (unsafe-merge invariant); per-owner scoping — same descriptor for two users → two clusters; descriptor-less faces remain unassigned; centroid stays L2-normalized after updates.
6. Docs: backend/README.md (clustering paragraph in ML Analysis, V03 in schema list, config row), backend/CHANGELOG.md.
Validation: ./gradlew spotlessApply build spotbugsMain jacocoTestCoverageVerification green.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation decisions: (1) Clusters are owner-scoped (photo uploader) — personal-library-first privacy model; Space-level grouping deliberately deferred. (2) Incremental nearest-centroid assignment runs inside the same transaction that persists photo_faces, in response-face order, serialized per owner via the existing TransactionalLockService advisory lock — deterministic by construction and atomic with face persistence; re-analysis (replace faces → reassign) converges naturally. (3) Threshold pina.ml.face-cluster-distance=0.6 cosine distance (≈ ArcFace cosine similarity 0.4); nearest cluster found via pgvector centroid <=> CAST(:d AS vector) per owner; em.flush() before the native query so clusters created earlier in the transaction are visible. (4) centroid_weight is a monotonic running count for the normalized-mean centroid update — visible face counts for TASK-035 browse must be derived from photo_faces at query time (photo deletions don't decrement the weight); empty clusters should be filtered (or cleaned) by the browse layer. (5) No implicit merging — merge/split/naming are explicit TASK-035 operations; schema carries nullable name and ON DELETE SET NULL on photo_faces.cluster_id so cluster deletion never breaks faces.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the face-clustering data foundation: per-owner stable clusters with deterministic incremental assignment.

**Schema** (`V03__face_clusters.sql`): `face_clusters` (owner FK, nullable user-facing name, centroid vector(512), monotonic centroid_weight, timestamps) and `photo_faces.cluster_id` (FK, ON DELETE SET NULL).

**Clustering** (`FaceClusterService`): runs inside the ML persist transaction right after faces are inserted, processing descriptors in response order under a per-owner advisory lock. Each descriptor joins the owner's nearest cluster (pgvector cosine distance vs centroid) when within `pina.ml.face-cluster-distance` (default 0.6 ≈ ArcFace cos-sim 0.4), updating the centroid as a normalized running mean; otherwise it seeds a new cluster. New photos therefore extend clusters without any rebuild (AC#2), and clusters never merge implicitly — naming/merge/split remain explicit operations for the TASK-035 API layer, which the schema already supports (AC#3). Faces without descriptors stay unassigned.

**Tests** (6 new @QuarkusTest via the fake ML @GrpcService with scripted descriptors): same descriptor across photos → one cluster with weight 2 and normalized centroid; two distinct faces in one photo → two clusters; near-duplicate (cos 0.8) joins incrementally; orthogonal descriptors never merge (unsafe-merge invariant); clusters never cross user boundaries; descriptor-less faces remain unassigned. Full backend build green (455 tests, SpotBugs, JaCoCo thresholds).

**Docs**: backend README (clustering section, V03, config row) and CHANGELOG updated.
<!-- SECTION:FINAL_SUMMARY:END -->
