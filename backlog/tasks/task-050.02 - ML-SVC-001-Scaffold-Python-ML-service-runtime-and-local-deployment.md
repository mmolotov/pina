---
id: TASK-050.02
title: ML-SVC-001 Scaffold Python ML service runtime and local deployment
status: Done
assignee:
  - '@claude'
created_date: '2026-04-20 13:55'
updated_date: '2026-06-12 06:26'
labels:
  - ml
  - python
  - ops
milestone: m-3
dependencies:
  - TASK-050.01
references:
  - >-
    backlog/tasks/task-049 -
    ML-PLAN-001-Define-Phase-4-ML-service-delivery-plan.md
documentation:
  - README.md
  - ml/README.md
  - docs/adr.adoc
  - docs/product-requirements.adoc
parent_task_id: TASK-050
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the first runnable ML service in `ml/` as a Python application with FastAPI for admin or health endpoints and a gRPC server for backend inference traffic. The task should establish project structure, configuration, Docker integration, and a clean boot path for local development and compose-based deployments.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `ml/` contains a runnable Python service layout with FastAPI admin or health endpoints and a gRPC server started from shared configuration
- [x] #2 The local stack includes Docker or Compose wiring for the ML service, persistent model-cache storage, and health or readiness checks
- [x] #3 Runtime configuration covers cache paths, network ports, execution-provider selection, and deployable profile selection without code edits
- [x] #4 A smoke test or startup validation path proves the service can boot locally and report healthy state before model-specific pipeline work lands
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Project layout: `ml/` as a uv-managed Python 3.12 project (pyproject.toml + uv.lock, src layout). Runtime deps: grpcio, grpcio-health-checking, protobuf, fastapi, uvicorn, pydantic-settings. Dev deps: pytest, pytest-asyncio, httpx, grpcio-tools, ruff. Heavy inference deps (onnxruntime etc.) intentionally deferred to TASK-050.03/04.
2. Configuration (`pina_ml.config`, pydantic-settings, env prefix `PINA_ML_`): grpc host/port, http host/port, model_cache_dir, profile (`default` | `cpu-lite`), execution_providers list, log level — covers AC#3 without code edits.
3. Servers: grpc.aio server registering ImageAnalysis servicer (AnalyzeImage/EmbedText return UNIMPLEMENTED until TASK-050.04; GetServiceStatus returns version + active profile + ready state) plus standard grpc.health.v1 service; FastAPI admin app with /healthz, /readyz, /api/info; single asyncio entrypoint `pina_ml.main` runs both with graceful shutdown.
4. Codegen wiring: ml/Makefile target `proto` invokes ../proto/scripts/generate-python.sh into ml/src (generated `pina/ml/v1` namespace package, gitignored); conftest fails with a clear "run make proto" message when stubs are missing.
5. Docker/Compose: docker/Dockerfile.ml (uv-based multi-stage, generates proto during build), compose service `ml` with persistent model-cache volume, /healthz healthcheck, env-driven config.
6. Tests + CI: pytest smoke test boots both servers in-process on ephemeral ports and asserts HTTP /healthz + gRPC health SERVING + GetServiceStatus payload; new .github/workflows/ml.yml runs ruff + proto generation + pytest on ml/** and proto/** changes.
7. Docs: rewrite ml/README.md (stale "Phase 3" placeholder) with layout, config reference, run/test commands; update ml/CHANGELOG.md and docker/CHANGELOG.md.
Validation: `make proto && uv run pytest` green locally; `docker compose -f docker/docker-compose.yml up --build ml` reports healthy.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation decisions: (1) uv-managed src-layout project pinned to Python 3.12 (.python-version) to match the Docker base image ghcr.io/astral-sh/uv:python3.12-bookworm-slim; heavy inference deps (onnxruntime) deliberately deferred to TASK-050.03/04 to keep the scaffold image small. (2) Generated pina/ml/v1 modules land in ml/src/pina (gitignored); editable install puts src/ on sys.path so the namespace package resolves without manual packaging tricks; conftest exits with a clear 'run make proto' message when stubs are missing. (3) grpc.aio + grpc_health.v1 aio HealthServicer report SERVING for the empty service name and pina.ml.v1.ImageAnalysis; AnalyzeImage/EmbedText abort UNIMPLEMENTED until TASK-050.04. (4) Docker multi-stage: build stage syncs dev deps and generates stubs, runtime stage syncs --no-dev and runs as non-root uid 10001 with /models volume; healthcheck uses `uv run --no-sync python -c urllib...` because the slim image has no wget/curl. (5) Compose service `ml` with mlmodels named volume; PINA_ML_PROFILE passed through from host env with `default` fallback. (6) New ML CI workflow (ruff check+format, proto generation, pytest) triggers on ml/** and proto/**.

Verification: make format/lint/test green (5 pytest tests: config defaults+env overrides, gRPC health+status+UNIMPLEMENTED, admin endpoints); compose build+up reaches healthy in ~12s; from-host curl of /healthz,/readyz,/api/info OK and gRPC client check against the container returned SERVING / version 0.1.0 / profile default / UNIMPLEMENTED for AnalyzeImage. Docker build initially failed because hatchling requires README.md referenced from pyproject — fixed by copying it into the runtime stage.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Scaffolded the runnable Python ML service in `ml/` with local and Docker deployment wiring.

**Service**: grpc.aio server hosting `pina.ml.v1.ImageAnalysis` (GetServiceStatus live with version/profile/ready; AnalyzeImage and EmbedText return UNIMPLEMENTED until TASK-050.04) plus standard `grpc.health.v1` health reporting SERVING; FastAPI admin app with `/healthz`, `/readyz` (503 until gRPC is up), `/api/info`; single asyncio entrypoint `pina-ml` with graceful shutdown.

**Configuration** (`PINA_ML_*` env, pydantic-settings): grpc/http host+port, model cache dir, runtime profile (`default`/`cpu-lite`), ONNX execution-provider list, log level — profile and provider selection require no code edits.

**Project**: uv-managed (pyproject + uv.lock, Python 3.12 pinned), Makefile (`proto`/`lint`/`format`/`test`/`run`/`clean`), generated gRPC modules from `../proto` into gitignored `src/pina/`, ruff lint+format, pytest suite (5 tests: config + gRPC smoke + admin smoke).

**Deployment**: `docker/Dockerfile.ml` (uv multi-stage, stubs generated during build, non-root user, healthcheck) and compose service `ml` with persistent `mlmodels` volume; verified end-to-end — container healthy in ~12s, host-side curl + gRPC client confirmed SERVING/status/UNIMPLEMENTED.

**CI**: new `.github/workflows/ml.yml` (uv sync, proto generation, ruff, pytest) on `ml/**` and `proto/**` paths.

**Docs**: ml/README.md rewritten (layout, commands, config table, endpoints, Docker usage); ml/ and docker/ CHANGELOGs updated.
<!-- SECTION:FINAL_SUMMARY:END -->
