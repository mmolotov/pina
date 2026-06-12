"""Photo analysis pipeline: CLIP embeddings, zero-shot tags, face analysis."""

from pina_ml.pipeline.pipeline import PACKAGED_VOCABULARY, PhotoAnalysisPipeline
from pina_ml.pipeline.types import (
    AnalysisResult,
    FaceResult,
    ImageDecodeError,
    StepOutcome,
    StepState,
    TagResult,
)

__all__ = [
    "PACKAGED_VOCABULARY",
    "AnalysisResult",
    "FaceResult",
    "ImageDecodeError",
    "PhotoAnalysisPipeline",
    "StepOutcome",
    "StepState",
    "TagResult",
]
