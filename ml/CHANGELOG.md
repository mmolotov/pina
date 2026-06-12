# Changelog — ML Service

All notable changes to the PINA ML service module will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Model registry: YAML manifests (task step, version, source files, license
  metadata), persistent artifact cache with zip-archive member extraction and
  optional sha256 verification, and background downloads on startup.
- Runtime profiles `default` (CLIP ViT-B/32 fp32 + InsightFace buffalo_l) and
  `cpu-lite` (CLIP int8 + buffalo_s) with per-profile concurrency and analysis
  resolution limits.
- License flagging for restricted models (InsightFace packs are
  non-commercial research only) via startup warnings and `GET /api/models`.
- `GetServiceStatus` now reports real per-model availability; new admin
  endpoint `GET /api/models`.

- Runnable service scaffold: grpc.aio server for `pina.ml.v1.ImageAnalysis`
  (status RPC live, inference RPCs `UNIMPLEMENTED` until the pipeline lands)
  with standard `grpc.health.v1` health, plus a FastAPI admin surface
  (`/healthz`, `/readyz`, `/api/info`).
- Env-driven configuration (`PINA_ML_*`): ports, model cache dir, runtime
  profile (`default` / `cpu-lite`), execution providers, log level.
- uv-managed project layout with Makefile (proto/lint/format/test/run),
  pytest smoke suite, and ML CI workflow.
- Docker image (`docker/Dockerfile.ml`) and compose service with persistent
  model-cache volume and healthcheck.
