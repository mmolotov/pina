#!/usr/bin/env bash
# Generates Python protobuf/gRPC modules from the shared PINA proto contract.
#
# Usage: generate-python.sh <output-dir>
#
# Requires grpcio-tools on the invoking interpreter, e.g.:
#   uv run --with grpcio-tools proto/scripts/generate-python.sh ml/src
#   python -m pip install grpcio-tools && proto/scripts/generate-python.sh ml/src
#
# Generated modules mirror the proto package, e.g. pina/ml/v1/common_pb2.py,
# so <output-dir> must be an import root of the consuming project.
set -euo pipefail

PROTO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:?usage: generate-python.sh <output-dir>}"

mkdir -p "$OUT_DIR"

python -m grpc_tools.protoc \
  --proto_path="$PROTO_DIR" \
  --python_out="$OUT_DIR" \
  --pyi_out="$OUT_DIR" \
  --grpc_python_out="$OUT_DIR" \
  "$PROTO_DIR"/pina/ml/v1/*.proto

echo "Generated pina.ml.v1 Python modules in $OUT_DIR"
