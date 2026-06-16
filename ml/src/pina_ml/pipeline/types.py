from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from pina_ml.registry import ModelManifest, PipelineStep


class StepState(StrEnum):
    """Mirrors pina.ml.v1.StepStatus enum value names."""

    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    SKIPPED_DISABLED = "SKIPPED_DISABLED"
    SKIPPED_UNAVAILABLE = "SKIPPED_UNAVAILABLE"


@dataclass(frozen=True)
class StepOutcome:
    step: PipelineStep
    state: StepState
    manifest: ModelManifest | None = None
    error: str | None = None
    duration_ms: int = 0


@dataclass(frozen=True)
class TagResult:
    label: str
    confidence: float


@dataclass(frozen=True)
class FaceResult:
    """Normalized [0,1] bounding box plus an optional descriptor."""

    x: float
    y: float
    width: float
    height: float
    confidence: float
    embedding: list[float] | None


@dataclass(frozen=True)
class AnalysisResult:
    outcomes: list[StepOutcome]
    image_embedding: list[float] | None
    tags: list[TagResult]
    faces: list[FaceResult]


class ImageDecodeError(ValueError):
    """Raised when the request payload cannot be decoded as an image."""
