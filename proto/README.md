# PINA gRPC contract

Shared protocol definitions for the backend ↔ ML boundary. Both sides generate
code from this directory; there are no manually copied or checked-in generated
sources.

## Layout

```
pina/ml/v1/common.proto          # analysis steps, per-step status, model provenance, embeddings
pina/ml/v1/image_analysis.proto  # ImageAnalysis service: AnalyzeImage, EmbedText, GetServiceStatus
scripts/generate-python.sh       # Python codegen entrypoint for the ML service
```

The contract is photo-first for Phase 4 but media-agnostic: photos and future
video keyframes (Phase 7) go through the same `AnalyzeImage` RPC, disambiguated
by `MediaContext.kind`.

## Consumers

### Backend (Quarkus, Java)

`backend/build.gradle.kts` points Quarkus gRPC code generation at this
directory via `quarkus.grpc.codegen.proto-directory`. Stubs (including Mutiny
variants) are generated into `dev.pina.ml.v1` on every build — no manual step.

### ML service (Python)

```bash
proto/scripts/generate-python.sh <output-dir>   # requires grpcio-tools
```

Generated modules mirror the proto package (`pina/ml/v1/*_pb2*.py(i)`), so the
output dir must be an import root. The `ml/` build invokes this script; see
`ml/README.md`.

## Health

Liveness/readiness uses the standard `grpc.health.v1.Health` protocol provided
by gRPC runtime libraries on both sides; it is deliberately not vendored here.
Application-level state (active profile, per-model availability) is exposed via
`ImageAnalysis.GetServiceStatus`.

## Evolution rules

`pina.ml.v1` is additive-only:

- append new fields and enum values; never renumber, remove, or repurpose
- mark retired fields `reserved` instead of deleting them
- a breaking change requires a new `pina.ml.v2` package, not an edit to v1

The backend test `MlProtoContractTest` pins the message/field/RPC shape against
a golden fixture. After an intentional contract change, regenerate it and
review the diff together with the ML-side impact:

```bash
cd backend && ./gradlew test --tests "*MlProtoContractTest" -Dpina.proto.golden.update=true
```
