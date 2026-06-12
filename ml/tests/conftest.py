import pytest

try:
    from pina.ml.v1 import common_pb2  # noqa: F401
except ModuleNotFoundError:
    pytest.exit(
        "Generated gRPC modules are missing - run `make proto` in ml/ first (see ml/README.md)",
        returncode=4,
    )
