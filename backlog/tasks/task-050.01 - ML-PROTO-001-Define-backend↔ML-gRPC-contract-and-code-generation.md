---
id: TASK-050.01
title: ML-PROTO-001 Define backend↔ML gRPC contract and code generation
status: Done
assignee:
  - '@claude'
created_date: '2026-04-20 13:55'
updated_date: '2026-06-11 17:29'
labels:
  - ml
  - proto
  - backend
milestone: m-3
dependencies: []
references:
  - >-
    backlog/tasks/task-049 -
    ML-PLAN-001-Define-Phase-4-ML-service-delivery-plan.md
documentation:
  - MILESTONES.md
  - docs/adr.adoc
  - docs/product-requirements.adoc
  - proto/README.md
parent_task_id: TASK-050
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Define the shared `proto/` contract for the backend↔ML boundary and wire code generation so both sides build from one source of truth. The first contract should stay photo-first for Phase 4 while remaining media-agnostic enough to carry future keyframe analysis without a protocol redesign.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Shared proto definitions cover health, photo-analysis request and response payloads, model or step provenance, and explicit per-step result status
- [x] #2 Backend and ML-side builds generate or consume code from the same checked-in proto source without manual copy steps
- [x] #3 The contract keeps Phase 4 photo-first scope but avoids assumptions that would block future keyframe-based video analysis
- [x] #4 A compatibility check, golden fixture, or contract-focused test exists to reduce accidental drift between backend and ML implementations
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Contract: add `proto/pina/ml/v1/{common,photo_analysis}.proto`, package `pina.ml.v1` — `AnalysisStep` + `StepStatus` enums, `ModelRef` provenance, `Embedding`, `Tag`, `FaceDetection` (normalized bbox + descriptor), `MediaContext` with `MediaKind` (PHOTO | VIDEO_KEYFRAME seam for Phase 7), RPCs `AnalyzePhoto`, `EmbedText` (semantic-search seam), `GetServiceStatus` on one `PhotoAnalysisService`. Liveness/readiness uses the standard `grpc.health.v1` protocol from runtime libraries on both sides (documented in proto/README.md, not vendored).
2. Backend codegen: generate Quarkus Mutiny gRPC stubs from the shared `proto/` directory — prefer Quarkus code generation if an external proto dir is cleanly supported in the Gradle plugin, otherwise protobuf-gradle-plugin + `io.quarkus:quarkus-grpc-protoc-plugin` with BOM-aligned versions; add `quarkus-grpc` dependency.
3. Python codegen: add a generation entrypoint (grpcio-tools) that the ML service build (TASK-050.02) invokes against the same `proto/` source; no checked-in generated code, no manual copies.
4. Drift guard: golden descriptor fixture in backend test resources asserting message/field numbers and types of the v1 contract; plain JUnit test that runs in `./gradlew test` without containers.
5. Docs: rewrite `proto/README.md` (stale "Phase 3" placeholder) with contract layout, generation commands for both sides, and additive-only evolution rules for v1.
Validation: `./gradlew spotlessApply build` green including the golden contract test.

Executed with three refinements: (a) service/file named `ImageAnalysis`/`image_analysis.proto` with `AnalyzeImage` instead of PhotoAnalysis/AnalyzePhoto — more media-agnostic for the Phase 7 keyframe seam while staying photo-first; (b) `FaceDetection.embedding` instead of `.descriptor` because protobuf-java reserves `getDescriptor()` (compile collision); (c) backend codegen via `quarkus.grpc.codegen.proto-directory` build property — no protobuf-gradle-plugin needed.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation decisions: (1) Quarkus Gradle codegen reads the shared dir via quarkusBuildProperties[quarkus.grpc.codegen.proto-directory]; QuarkusGenerateCode tasks get proto/ registered as input for up-to-date correctness. (2) Generated dev.pina.ml.v1 classes are excluded from Spotless (targetExclude build/**), SpotBugs (package match in spotbugs-exclude.xml), and JaCoCo (%test.quarkus.jacoco.excludes for the CI XML report + classDirectories excludes for the Gradle verification task) so quality gates keep measuring only hand-written code. (3) Backend CI workflow now also triggers on proto/** since backend codegen depends on it. (4) Python side verified end-to-end: proto/scripts/generate-python.sh generates importable pina.ml.v1 modules (validated in a throwaway venv with grpcio-tools); ml/ build wiring lands with TASK-050.02. (5) Golden contract test supports intentional evolution via -Dpina.proto.golden.update=true (documented in proto/README.md).

Unrelated pre-existing flake fixed to keep the suite green: AlbumResourceTest.downloadByTokenWithTamperedTokenReturns404 tampered the final base64url char of the 43-char HMAC signature, which carries only 4 significant bits — Java's lenient decoder drops the trailing bits, so ~6% of runs the 'tampered' token decoded to the same signature and the test failed (200 instead of 404). The test now tampers a fully significant signature character.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Defined the shared backend↔ML gRPC contract and wired code generation on both sides from one checked-in source.

**Contract** (`proto/pina/ml/v1/`): `common.proto` (AnalysisStep, StepStatus, ModelRef provenance, Embedding) and `image_analysis.proto` (ImageAnalysis service: AnalyzeImage, EmbedText, GetServiceStatus; MediaContext with PHOTO|VIDEO_KEYFRAME keeps the Phase 7 keyframe seam; per-step StepResult means one failing model never fails the RPC). Liveness uses standard grpc.health.v1 from runtime libraries (documented, not vendored).

**Backend codegen**: `quarkus-grpc` + `quarkus.grpc.codegen.proto-directory` pointing at the shared `proto/` dir; Mutiny stubs generated into `dev.pina.ml.v1` on every build. Generated code excluded from Spotless, SpotBugs, and JaCoCo accounting; backend CI also triggers on `proto/**`.

**Python codegen**: `proto/scripts/generate-python.sh` (grpcio-tools, --python/--pyi/--grpc_python out) validated end-to-end in a venv; the ml/ build consumes it in TASK-050.02.

**Drift guard**: `MlProtoContractTest` pins file/message/field-number/RPC shape against a golden fixture (`src/test/resources/proto/pina-ml-v1-contract.txt`); intentional changes regenerate via `-Dpina.proto.golden.update=true`.

**Docs**: proto/README.md rewritten (layout, consumers, health, additive-only v1 evolution rules), proto/CHANGELOG.md updated.

**Verification**: `./gradlew spotlessApply build spotbugsMain` green (442 tests + contract test), `jacocoTestCoverageVerification` passes with generated classes excluded. Also fixed a pre-existing ~6%-probability flake in AlbumResourceTest (tampered-token test hit base64 trailing-bit leniency).
<!-- SECTION:FINAL_SUMMARY:END -->
