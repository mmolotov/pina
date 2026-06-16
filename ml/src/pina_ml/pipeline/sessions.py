from __future__ import annotations

import logging
from pathlib import Path

import onnxruntime as ort

from pina_ml.config import Settings

LOG = logging.getLogger(__name__)


def create_session(model_path: Path, settings: Settings) -> ort.InferenceSession:
    """Creates an ONNX Runtime session honoring the configured providers.

    Unavailable providers are dropped with a warning; CPUExecutionProvider is
    always appended as the final fallback.
    """
    available = set(ort.get_available_providers())
    providers = [name for name in settings.execution_providers if name in available]
    dropped = [name for name in settings.execution_providers if name not in available]
    if dropped:
        LOG.warning(
            "Execution providers %s are not available in this runtime (available: %s)",
            dropped,
            sorted(available),
        )
    if "CPUExecutionProvider" not in providers:
        providers.append("CPUExecutionProvider")
    options = ort.SessionOptions()
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    return ort.InferenceSession(str(model_path), sess_options=options, providers=providers)
