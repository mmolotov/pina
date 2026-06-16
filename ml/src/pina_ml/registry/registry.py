from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

from pina_ml.config import Settings
from pina_ml.registry.downloads import ArtifactDownloader
from pina_ml.registry.manifest import (
    ModelManifest,
    PipelineStep,
    RuntimeProfileSpec,
    load_model_manifest,
    load_profile_spec,
)

LOG = logging.getLogger(__name__)

PACKAGED_MANIFESTS_DIR = Path(__file__).resolve().parent.parent / "manifests"


class RegistryError(RuntimeError):
    """Raised for invalid registry configuration."""


@dataclass(frozen=True)
class ModelAvailability:
    manifest: ModelManifest
    step: PipelineStep
    available: bool


@dataclass(frozen=True)
class ResolvedModel:
    """A model whose artifacts are all present in the local cache."""

    manifest: ModelManifest
    files: dict[str, Path]


class ModelRegistry:
    """Resolves the active profile to concrete, locally cached model files."""

    def __init__(
        self,
        models: dict[str, ModelManifest],
        profile: RuntimeProfileSpec,
        downloader: ArtifactDownloader,
    ) -> None:
        self._models = models
        self._profile = profile
        self._downloader = downloader

    @classmethod
    def load(cls, settings: Settings) -> ModelRegistry:
        """Loads packaged manifests plus an optional operator override dir."""
        manifest_dirs = [PACKAGED_MANIFESTS_DIR]
        if settings.manifests_dir is not None:
            manifest_dirs.append(settings.manifests_dir)

        models: dict[str, ModelManifest] = {}
        profiles: dict[str, RuntimeProfileSpec] = {}
        for base in manifest_dirs:
            for path in sorted((base / "models").glob("*.yaml")):
                manifest = load_model_manifest(path)
                models[manifest.id] = manifest
            for path in sorted((base / "profiles").glob("*.yaml")):
                profile = load_profile_spec(path)
                profiles[profile.name] = profile

        active = profiles.get(settings.profile.value)
        if active is None:
            raise RegistryError(f"Runtime profile {settings.profile.value!r} is not defined")
        for step, step_config in active.steps.items():
            if step_config.model not in models:
                raise RegistryError(
                    f"Profile {active.name!r} references unknown model"
                    f" {step_config.model!r} for step {step.value}"
                )
        return cls(
            models=models,
            profile=active,
            downloader=ArtifactDownloader(settings.model_cache_dir),
        )

    @property
    def profile(self) -> RuntimeProfileSpec:
        return self._profile

    def manifest(self, model_id: str) -> ModelManifest:
        manifest = self._models.get(model_id)
        if manifest is None:
            raise RegistryError(f"Unknown model id: {model_id}")
        return manifest

    def required(self) -> list[tuple[PipelineStep, ModelManifest]]:
        """Models the active profile needs, in pipeline-step order."""
        entries: list[tuple[PipelineStep, ModelManifest]] = []
        for step in PipelineStep:
            step_config = self._profile.steps.get(step)
            if step_config is None or not step_config.enabled:
                continue
            entries.append((step, self.manifest(step_config.model)))
        return entries

    def is_model_available(self, manifest: ModelManifest) -> bool:
        return all(
            self._downloader.is_cached(manifest.id, manifest.version, artifact)
            for artifact in manifest.files
        )

    def availability(self) -> list[ModelAvailability]:
        return [
            ModelAvailability(
                manifest=manifest, step=step, available=self.is_model_available(manifest)
            )
            for step, manifest in self.required()
        ]

    @property
    def ready(self) -> bool:
        """True when every model required by the active profile is cached."""
        return all(entry.available for entry in self.availability())

    async def ensure_model(self, manifest: ModelManifest) -> ResolvedModel:
        files = {
            artifact.name: await self._downloader.ensure(manifest.id, manifest.version, artifact)
            for artifact in manifest.files
        }
        return ResolvedModel(manifest=manifest, files=files)

    async def ensure_step(self, step: PipelineStep) -> ResolvedModel:
        step_config = self._profile.steps.get(step)
        if step_config is None or not step_config.enabled:
            raise RegistryError(
                f"Step {step.value} is not enabled in profile {self._profile.name!r}"
            )
        return await self.ensure_model(self.manifest(step_config.model))

    async def ensure_all(self) -> None:
        for step, manifest in self.required():
            await self.ensure_model(manifest)
            LOG.info(
                "Model %s %s is available for step %s", manifest.id, manifest.version, step.value
            )

    def license_warnings(self) -> list[str]:
        """Human-readable flags for restricted models in the active profile."""
        warnings: list[str] = []
        for step, manifest in self.required():
            license_info = manifest.license
            if license_info.commercial_use and license_info.allow_bundling:
                continue
            notes = f" {license_info.notes}" if license_info.notes else ""
            warnings.append(
                f"Model {manifest.id} ({license_info.spdx}, step {step.value}) is restricted:"
                f" commercial_use={license_info.commercial_use},"
                f" allow_bundling={license_info.allow_bundling}."
                f" It is downloaded at runtime onto this instance and must not be redistributed"
                f" or baked into distributable images.{notes}"
            )
        return warnings
