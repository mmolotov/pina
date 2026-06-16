from __future__ import annotations

import asyncio
import dataclasses
import io
import logging
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from pina_ml.config import Settings
from pina_ml.pipeline import clip, faces
from pina_ml.pipeline.sessions import create_session
from pina_ml.pipeline.types import (
    AnalysisResult,
    FaceResult,
    ImageDecodeError,
    StepOutcome,
    StepState,
    TagResult,
)
from pina_ml.registry import ModelManifest, ModelRegistry, PipelineStep, ResolvedModel

LOG = logging.getLogger(__name__)

PACKAGED_VOCABULARY = Path(__file__).resolve().parent / "data" / "tag_vocabulary.txt"


@dataclass(frozen=True)
class _LoadedStep:
    manifest: ModelManifest
    impl: object


class PhotoAnalysisPipeline:
    """Runs the profile-enabled analysis steps for one image.

    Models load lazily through the registry (downloading on first use), and
    every step reports an explicit outcome so a single model failure never
    fails the whole RPC.
    """

    def __init__(self, settings: Settings, registry: ModelRegistry) -> None:
        self._settings = settings
        self._registry = registry
        self._semaphore = asyncio.Semaphore(registry.profile.max_parallel_analyses)
        self._load_lock = asyncio.Lock()
        self._loaded: dict[PipelineStep, _LoadedStep] = {}
        self._label_cache: tuple[list[str], np.ndarray] | None = None

    async def analyze(self, image_bytes: bytes, requested: list[PipelineStep]) -> AnalysisResult:
        async with self._semaphore:
            image = await asyncio.to_thread(self._decode, image_bytes)
            return await self._run_steps(image, requested)

    async def embed_text(self, text: str) -> tuple[list[float], ModelManifest]:
        loaded = await self._load_step(PipelineStep.TAGGING)
        text_model: clip.ClipTextModel = loaded.impl  # type: ignore[assignment]
        embeddings = await asyncio.to_thread(text_model.embed, [text])
        return [float(value) for value in embeddings[0]], loaded.manifest

    async def _run_steps(self, image: Image.Image, requested: list[PipelineStep]) -> AnalysisResult:
        outcomes: list[StepOutcome] = []
        states: dict[PipelineStep, StepState] = {}
        image_embedding: np.ndarray | None = None
        tags: list[TagResult] = []
        face_results: list[FaceResult] = []
        detections: list[faces.DetectedFace] = []

        for step, enabled in self._plan(requested):
            if not enabled:
                outcomes.append(StepOutcome(step=step, state=StepState.SKIPPED_DISABLED))
                states[step] = StepState.SKIPPED_DISABLED
                continue

            started = time.perf_counter()
            try:
                loaded = await self._load_step(step)
            except Exception as error:  # registry/download/session failures
                LOG.warning("Model for step %s is unavailable: %s", step.value, error)
                outcome = StepOutcome(
                    step=step,
                    state=StepState.SKIPPED_UNAVAILABLE,
                    error=f"model unavailable: {error}",
                    duration_ms=_elapsed_ms(started),
                )
                outcomes.append(outcome)
                states[step] = outcome.state
                continue

            try:
                if step is PipelineStep.IMAGE_EMBEDDING:
                    vision: clip.ClipVisionModel = loaded.impl  # type: ignore[assignment]
                    image_embedding = await asyncio.to_thread(vision.embed, image)
                elif step is PipelineStep.TAGGING:
                    if image_embedding is None:
                        outcome = StepOutcome(
                            step=step,
                            state=StepState.SKIPPED_UNAVAILABLE,
                            manifest=loaded.manifest,
                            error="requires a completed image embedding step",
                            duration_ms=_elapsed_ms(started),
                        )
                        outcomes.append(outcome)
                        states[step] = outcome.state
                        continue
                    tags = await self._run_tagging(loaded, image_embedding)
                elif step is PipelineStep.FACE_DETECTION:
                    detector: faces.ScrfdDetector = loaded.impl  # type: ignore[assignment]
                    detections = await asyncio.to_thread(detector.detect, image)
                    face_results = [
                        FaceResult(
                            x=face.bbox[0],
                            y=face.bbox[1],
                            width=face.bbox[2],
                            height=face.bbox[3],
                            confidence=face.confidence,
                            embedding=None,
                        )
                        for face in detections
                    ]
                elif step is PipelineStep.FACE_EMBEDDING:
                    if states.get(PipelineStep.FACE_DETECTION) is not StepState.COMPLETED:
                        outcome = StepOutcome(
                            step=step,
                            state=StepState.SKIPPED_UNAVAILABLE,
                            manifest=loaded.manifest,
                            error="requires a completed face detection step",
                            duration_ms=_elapsed_ms(started),
                        )
                        outcomes.append(outcome)
                        states[step] = outcome.state
                        continue
                    face_results = await self._run_face_embedding(
                        loaded, image, detections, face_results
                    )
                outcome = StepOutcome(
                    step=step,
                    state=StepState.COMPLETED,
                    manifest=loaded.manifest,
                    duration_ms=_elapsed_ms(started),
                )
            except Exception as error:
                LOG.exception("Step %s failed", step.value)
                outcome = StepOutcome(
                    step=step,
                    state=StepState.FAILED,
                    manifest=loaded.manifest,
                    error=str(error),
                    duration_ms=_elapsed_ms(started),
                )
            outcomes.append(outcome)
            states[step] = outcome.state

        embedding_values = (
            [float(value) for value in image_embedding] if image_embedding is not None else None
        )
        return AnalysisResult(
            outcomes=outcomes,
            image_embedding=embedding_values,
            tags=tags,
            faces=face_results,
        )

    def _plan(self, requested: list[PipelineStep]) -> list[tuple[PipelineStep, bool]]:
        """Steps to report, in pipeline order, with their run/disabled flag."""
        wanted = set(requested) if requested else set(PipelineStep)
        plan: list[tuple[PipelineStep, bool]] = []
        for step in PipelineStep:
            if step not in wanted:
                continue
            step_config = self._registry.profile.steps.get(step)
            enabled = step_config is not None and step_config.enabled
            plan.append((step, enabled))
        return plan

    async def _run_tagging(
        self, loaded: _LoadedStep, image_embedding: np.ndarray
    ) -> list[TagResult]:
        labels, label_embeddings = await self._label_embeddings(loaded)
        scored = await asyncio.to_thread(
            clip.score_tags,
            image_embedding,
            label_embeddings,
            labels,
            self._settings.tag_top_k,
            self._settings.tag_min_confidence,
        )
        return [TagResult(label=label, confidence=confidence) for label, confidence in scored]

    async def _run_face_embedding(
        self,
        loaded: _LoadedStep,
        image: Image.Image,
        detections: list[faces.DetectedFace],
        face_results: list[FaceResult],
    ) -> list[FaceResult]:
        arcface: faces.ArcFaceModel = loaded.impl  # type: ignore[assignment]
        embedded: list[FaceResult] = []
        for detection, face in zip(detections, face_results, strict=True):
            vector = await asyncio.to_thread(arcface.embed, image, detection.landmarks)
            embedded.append(dataclasses.replace(face, embedding=[float(value) for value in vector]))
        return embedded

    async def _label_embeddings(self, loaded: _LoadedStep) -> tuple[list[str], np.ndarray]:
        if self._label_cache is None:
            vocabulary_path = self._settings.tags_vocabulary_path or PACKAGED_VOCABULARY
            labels = clip.load_vocabulary(vocabulary_path)
            if not labels:
                raise ValueError(f"Tag vocabulary is empty: {vocabulary_path}")
            text_model: clip.ClipTextModel = loaded.impl  # type: ignore[assignment]
            prompts = [clip.prompt_for(label) for label in labels]
            embeddings = await asyncio.to_thread(text_model.embed, prompts)
            self._label_cache = (labels, embeddings)
        return self._label_cache

    async def _load_step(self, step: PipelineStep) -> _LoadedStep:
        loaded = self._loaded.get(step)
        if loaded is not None:
            return loaded
        async with self._load_lock:
            loaded = self._loaded.get(step)
            if loaded is not None:
                return loaded
            resolved = await self._registry.ensure_step(step)
            loaded = await asyncio.to_thread(self._build_step, step, resolved)
            self._loaded[step] = loaded
            return loaded

    def _build_step(self, step: PipelineStep, resolved: ResolvedModel) -> _LoadedStep:
        manifest = resolved.manifest
        model_path = _file_by_suffix(resolved, ".onnx")
        session = create_session(model_path, self._settings)
        if step is PipelineStep.IMAGE_EMBEDDING:
            image_size = int(manifest.input.get("image_size", 224))
            return _LoadedStep(manifest, clip.ClipVisionModel(session, image_size))
        if step is PipelineStep.TAGGING:
            tokenizer_path = _file_by_suffix(resolved, "tokenizer.json")
            return _LoadedStep(manifest, clip.ClipTextModel(session, tokenizer_path))
        if step is PipelineStep.FACE_DETECTION:
            return _LoadedStep(
                manifest, faces.ScrfdDetector(session, self._settings.face_min_confidence)
            )
        if step is PipelineStep.FACE_EMBEDDING:
            return _LoadedStep(manifest, faces.ArcFaceModel(session))
        raise ValueError(f"Unsupported pipeline step: {step}")

    def _decode(self, data: bytes) -> Image.Image:
        if not data:
            raise ImageDecodeError("Image payload is empty")
        try:
            opened = Image.open(io.BytesIO(data))
            opened.load()
        except (UnidentifiedImageError, OSError, ValueError) as error:
            raise ImageDecodeError(f"Cannot decode image payload: {error}") from error
        image = ImageOps.exif_transpose(opened).convert("RGB")
        max_resolution = self._registry.profile.analysis_max_resolution
        if max(image.size) > max_resolution:
            image.thumbnail((max_resolution, max_resolution), Image.Resampling.BILINEAR)
        return image


def _file_by_suffix(resolved: ResolvedModel, suffix: str) -> Path:
    for name, path in resolved.files.items():
        if name.endswith(suffix):
            return path
    raise ValueError(f"Model {resolved.manifest.id} has no artifact matching *{suffix}")


def _elapsed_ms(started: float) -> int:
    return int((time.perf_counter() - started) * 1000)
