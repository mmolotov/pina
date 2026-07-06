---
name: proto-change
description: Evolve the shared backend↔ML gRPC contract (proto/pina/ml/v1) safely — append-only wire changes, buf lint, regeneration on both sides, and the golden contract fixture. Use whenever a .proto file changes or a contract change is being planned.
---

# Proto Change (pina.ml.v1)

`proto/` is the single contract between the Java backend (Quarkus gRPC codegen reads `../proto`
at build time via `quarkus.grpc.codegen.proto-directory`) and the Python ML service (`make proto`
writes untracked stubs into `ml/src/pina/ml/v1/`). CI (`proto.yml`) runs `buf lint` and
`buf breaking` against the PR base branch — a wire-incompatible change will not merge.

## Wire rules (append-only)

- Never renumber, remove, or retype existing fields, enum values, or RPCs.
- Additions get fresh field numbers; removals become `reserved <number>, "<name>";`.
- proto3 semantics: new fields must be safe for an old peer to leave unset.

## Workflow

1. Edit the schema in `proto/pina/ml/v1/*.proto`.
2. Lint locally: `cd proto && buf lint`.
3. Regenerate the Python side: `cd ml && make proto`. Never hand-edit `ml/src/pina/ml/v1/` —
   the next codegen overwrites it (the guard hook blocks such edits anyway).
4. The backend regenerates stubs on any build. Refresh the golden contract fixture deliberately:
   ```bash
   cd backend && ./gradlew test --tests "*MlProtoContractTest" -Dpina.proto.golden.update=true
   ```
   Then review the diff of `backend/src/test/resources/proto/pina-ml-v1-contract.txt` line by
   line — that diff IS the contract change.
5. Update the consuming code on both sides (backend `service/` + `api/`, ml handlers/pipeline).
6. Record the change in `proto/CHANGELOG.md`, then run `/preflight` before the PR.
