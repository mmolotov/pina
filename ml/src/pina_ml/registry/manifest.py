from __future__ import annotations

from enum import StrEnum
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, Field


class PipelineStep(StrEnum):
    """Pipeline steps; names mirror the pina.ml.v1.AnalysisStep proto enum."""

    IMAGE_EMBEDDING = "image_embedding"
    TAGGING = "tagging"
    FACE_DETECTION = "face_detection"
    FACE_EMBEDDING = "face_embedding"


class ArchiveSpec(BaseModel):
    """Artifact packaged inside a source archive."""

    format: Literal["zip"] = "zip"
    member: str


class ArtifactSpec(BaseModel):
    """One downloadable file of a model."""

    name: str
    url: str
    sha256: str | None = None
    archive: ArchiveSpec | None = None


class LicenseInfo(BaseModel):
    """License metadata used to flag restricted models (AC: redistribution)."""

    spdx: str
    url: str | None = None
    commercial_use: bool = True
    allow_bundling: bool = True
    notes: str | None = None


class ModelManifest(BaseModel):
    id: str
    version: str
    step: PipelineStep
    runtime: str = "onnxruntime"
    license: LicenseInfo
    files: list[ArtifactSpec] = Field(min_length=1)
    input: dict[str, Any] = Field(default_factory=dict)
    output: dict[str, Any] = Field(default_factory=dict)


class ProfileStepConfig(BaseModel):
    model: str
    enabled: bool = True


class RuntimeProfileSpec(BaseModel):
    """Deployment profile: model selection plus hardware-friendly limits."""

    name: str
    max_parallel_analyses: int = 2
    analysis_max_resolution: int = 1280
    steps: dict[PipelineStep, ProfileStepConfig]


def load_model_manifest(path: Path) -> ModelManifest:
    return ModelManifest.model_validate(_read_yaml(path))


def load_profile_spec(path: Path) -> RuntimeProfileSpec:
    return RuntimeProfileSpec.model_validate(_read_yaml(path))


def _read_yaml(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if not isinstance(data, dict):
        raise ValueError(f"Manifest {path} must contain a YAML mapping")
    return data
