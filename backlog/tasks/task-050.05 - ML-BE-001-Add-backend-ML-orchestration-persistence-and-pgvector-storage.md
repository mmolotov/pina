---
id: TASK-050.05
title: 'ML-BE-001 Add backend ML orchestration, persistence, and pgvector storage'
status: Done
assignee:
  - '@claude'
created_date: '2026-04-20 13:55'
updated_date: '2026-06-12 12:50'
labels:
  - backend
  - ml
  - search
milestone: m-3
dependencies:
  - TASK-050.01
  - TASK-050.04
references:
  - >-
    backlog/tasks/task-049 -
    ML-PLAN-001-Define-Phase-4-ML-service-delivery-plan.md
  - >-
    backlog/tasks/task-033 -
    BE-SEARCH-001-Search-API-foundation-and-result-model.md
  - backlog/tasks/task-034 - BE-SEARCH-002-Text-and-tag-search-API.md
  - >-
    backlog/tasks/task-036 -
    BE-SEARCH-004-Search-filters-sort-and-query-validation.md
documentation:
  - backend/README.md
  - docs/adr.adoc
  - docs/product-requirements.adoc
  - MILESTONES.md
parent_task_id: TASK-050
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the backend so photo ingestion can hand work off to the ML service asynchronously and persist the resulting ML outputs in a search-friendly schema. The resulting storage model should support pgvector retrieval, tag-based filtering, and downstream face-cluster APIs without inventing a parallel search data path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Photo upload can schedule or trigger ML analysis asynchronously without delaying the successful upload response
- [x] #2 The backend degrades gracefully when the ML service is unavailable and preserves a retryable path instead of dropping analysis silently
- [x] #3 Flyway migrations and backend domain or repository layers persist embeddings, tags, detections, and face descriptors in a schema suitable for pgvector-backed retrieval
- [x] #4 Backend tests cover orchestration behavior, degraded ML availability, persistence of ML outputs, and loading paths that downstream search work can consume
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Migration V02__ml_photo_analysis.sql: CREATE EXTENSION IF NOT EXISTS vector; photo_analysis_jobs (photo_id unique FK cascade, status PENDING|COMPLETED|FAILED, attempts, last_error, next_attempt_at lease-based, timestamps, due index); photo_embeddings (photo_id PK, model provenance, vector(512), HNSW cosine index); photo_tags (photo_id FK, label, confidence, provenance, unique (photo_id,label), label index); photo_faces (photo_id FK, normalized bbox floats, confidence, nullable descriptor vector(512), provenance). face_clusters and cluster_id arrive with TASK-050.06.
2. Entities + hibernate-vector: PhotoAnalysisJob, PhotoEmbedding (@JdbcTypeCode(SqlTypes.VECTOR) @Array(length=512) float[]), PhotoTag, PhotoFace; add org.hibernate.orm:hibernate-vector dependency (BOM-managed).
3. gRPC client: quarkus.grpc.clients.ml.* (host/port via PINA_ML_HOST/PINA_ML_PORT, default localhost:50051); inject Mutiny ImageAnalysis stub; per-call deadline from config.
4. Orchestration (service/MlAnalysisService): enqueueNewPhoto after successful photo persist in PhotoService.runHeavyPhase (new tx, INSERT ... ON CONFLICT (photo_id) DO NOTHING, never fails the upload, async poke); @Scheduled poll ({pina.ml.poll-interval}) claims due jobs with FOR UPDATE SKIP LOCKED using lease semantics (claim bumps attempts and pushes next_attempt_at by a lease so crashes self-heal); loads THUMB_MD (fallback COMPRESSED/ORIGINAL) variant bytes via StorageProvider; calls AnalyzeImage with media context PHOTO and request_id=job id; persists outputs transactionally replacing only categories whose step COMPLETED (embedding dim-guard 512); retry policy: transport errors and FAILED/SKIPPED_UNAVAILABLE steps → PENDING with exponential backoff (base/cap config) until max-attempts → FAILED; INVALID_ARGUMENT → terminal FAILED; SKIPPED_DISABLED counts as success.
5. Config (pina.ml.* @ConfigMapping): enabled (%test false by default, ML tests opt in via QuarkusTestProfile), poll-interval, deadline, max-attempts, backoff-base, backoff-cap, batch-size; compose: backend gets QUARKUS_GRPC_CLIENTS_ML_HOST=ml / PORT=50051 and a service_started dependency on ml (graceful degradation tolerates ML being down).
6. Loading paths for downstream search/faces: repository methods — tags by photo ids, nearest-photo-ids native query ORDER BY embedding <=> :vector LIMIT k, faces with descriptors by photo; exercised in tests so TASK-035/050.06/050.08 consume a proven model.
7. Tests (@QuarkusTest + fake in-process gRPC server via QuarkusTestResourceLifecycleManager overriding quarkus.grpc.clients.ml.port): happy path upload → job COMPLETED → embeddings/tags/faces rows with provenance; ML down (closed port) → upload still 201, job PENDING with attempts and future next_attempt_at (retryable, AC#2); INVALID_ARGUMENT → terminal FAILED; partial step failure → partial persistence + retry scheduled; duplicate upload → single job; pgvector nearest-neighbor ordering with seeded vectors; photo delete cascades ML rows.
8. Docs: backend/README.md (ML orchestration section), application.properties comments, docker compose update, CHANGELOGs.
Validation: ./gradlew spotlessApply build spotbugsMain + jacocoTestCoverageVerification green.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Repo context check (2026-06-11): docker compose and Quarkus dev services already run pgvector/pgvector:pg17, so this task only needs a Flyway migration with CREATE EXTENSION IF NOT EXISTS vector plus the new ML tables — no infra image changes. Useful existing seams: TransactionCallbacks.afterCommit (post-commit dispatch from PhotoService), quarkus-scheduler (already a dependency — fits retry of pending analysis jobs), PhotoUploadAdmission/PhotoVariantExecutor as patterns for bounded async work.

Implementation decisions: (1) Outbox-style photo_analysis_jobs with lease-based claiming (FOR UPDATE SKIP LOCKED; claim bumps attempts and pushes next_attempt_at by deadline+5min) — crash-safe without a RUNNING state; immediate post-enqueue poke via a single-thread daemon executor plus @Scheduled polling. (2) Only categories whose step reported COMPLETED are replaced on persist, so partial ML results survive and retries converge; FAILED/SKIPPED_UNAVAILABLE steps trigger exponential backoff up to max-attempts, INVALID_ARGUMENT is terminal, SKIPPED_DISABLED counts as success. (3) hibernate-vector maps vector(512) to float[] via @JdbcTypeCode(SqlTypes.VECTOR); nearest-neighbor query goes through a native ORDER BY embedding <=> CAST(:q AS vector) with a string vector literal (no driver-specific binding). (4) Embedding dimension guarded at 512; mismatching models fail the job terminally with a clear error rather than violating the column type. (5) enqueueNewPhoto never propagates failures into the upload path; dedup re-uploads are idempotent via INSERT ... ON CONFLICT (photo_id) DO NOTHING.

Two non-obvious Quarkus gRPC test gotchas worth remembering: (a) Quarkus bytecode-transforms generated *Grpc classes inside its classloader, so a hand-rolled io.grpc Netty server built from ImplBase.bindService() inside a @QuarkusTest registers an empty service ('Method not found'); host fakes as @GrpcService beans on the Quarkus test gRPC server instead. (b) In LaunchMode TEST the gRPC client ignores quarkus.grpc.clients.X.port and resolves quarkus.grpc.clients.X.test-port (default 9001 = local test server) — the degraded-ML test must set test-port to a closed port. Also: profile-prefixed properties (%test.pina.ml.enabled) beat plain keys from QuarkusTestResource maps regardless of ordinal; TestProfile overrides handle this correctly.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Backend now orchestrates asynchronous ML photo analysis and persists the outputs in a pgvector-backed schema.

**Schema** (`V02__ml_photo_analysis.sql`): enables the `vector` extension; `photo_analysis_jobs` (one per photo, lease-based retry bookkeeping), `photo_embeddings` (vector(512) + HNSW cosine index), `photo_tags` (unique per photo+label), `photo_faces` (normalized bbox, confidence, nullable descriptor vector(512)); all output rows carry model id/version provenance; everything cascades on photo delete.

**Orchestration** (`MlAnalysisService` + `MlConfig`): after a successful photo persist, `enqueueNewPhoto` inserts a job (ON CONFLICT DO NOTHING) and pokes the worker — the upload response is never delayed or failed (AC#1). The worker (scheduled poll + immediate poke) claims due jobs with FOR UPDATE SKIP LOCKED lease semantics, sends the THUMB_MD (fallback COMPRESSED/ORIGINAL) variant to `pina.ml.v1.ImageAnalysis/AnalyzeImage` via the Quarkus Mutiny gRPC client, and persists results transactionally, replacing only categories whose step COMPLETED. Failed/unavailable steps retry with exponential backoff to max-attempts; INVALID_ARGUMENT fails terminally; an unreachable ML service leaves jobs PENDING with scheduled retries (AC#2).

**Query paths** for downstream search/faces: tags by photo ids, cosine nearest-neighbor photo lookup (`embedding <=> :query`), per-photo face listings (AC#3).

**Tests** (7 new @QuarkusTest, suite total 449 green): fake ML service hosted as a @GrpcService on the Quarkus test gRPC server — full pipeline persistence with provenance, duplicate-upload idempotency, partial-failure retry until complete, INVALID_ARGUMENT terminal failure, pgvector nearest-neighbor ordering, photo-delete cascade, and a degraded profile (closed test-port) proving uploads succeed while jobs stay retryable (AC#4).

**Config/infra**: `pina.ml.*` settings + `quarkus.grpc.clients.ml.*` endpoint (env `PINA_ML_HOST`/`PINA_ML_PORT`); compose wires backend→ml with startup-order dependency only; backend README (ML Analysis section, schema, config table) and CHANGELOGs updated. Full build green: spotless, 449 tests, SpotBugs, JaCoCo thresholds.
<!-- SECTION:FINAL_SUMMARY:END -->
