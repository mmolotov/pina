# Changelog — Proto

All notable changes to the PINA gRPC protocol definitions will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- `pina.ml.v1` contract for the backend ↔ ML boundary: `ImageAnalysis` service
  (`AnalyzeImage`, `EmbedText`, `GetServiceStatus`) with per-step result status,
  model provenance, embeddings, tags, and face detections; media-agnostic
  `MediaContext` keeps a seam for Phase 7 video keyframes.
- Python codegen entrypoint `scripts/generate-python.sh` (grpcio-tools).
- Backend consumes the contract via Quarkus gRPC codegen
  (`quarkus.grpc.codegen.proto-directory`); golden contract test guards drift.
- `GetServiceStatus` reports model `License` (SPDX, commercial-use, bundling),
  the active `RuntimeProfile` (parallelism, resolution, execution providers),
  and read-only `InferenceSetting` knobs, for the admin ML/Analysis panel.
  Additive (`ModelAvailability.license` = 4; `GetServiceStatusResponse.profile`
  = 5, `inference_settings` = 6), so existing clients are unaffected.
