from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from manifest_fixtures import build_local_manifests
from pina_ml.config import Settings
from pina_ml.registry import ModelRegistry, PipelineStep, RegistryError


def make_settings(tmp_path: Path, manifests_dir: Path) -> Settings:
    return Settings(model_cache_dir=tmp_path / "cache", manifests_dir=manifests_dir)


async def test_ready_flips_after_ensure_all(tmp_path: Path) -> None:
    manifests_dir = build_local_manifests(tmp_path)
    registry = ModelRegistry.load(make_settings(tmp_path, manifests_dir))

    assert registry.ready is False
    assert all(not entry.available for entry in registry.availability())

    await registry.ensure_all()

    assert registry.ready is True
    assert all(entry.available for entry in registry.availability())

    resolved = await registry.ensure_step(PipelineStep.IMAGE_EMBEDDING)
    artifact_path = resolved.files["test-image-embedding.onnx"]
    assert artifact_path.read_bytes() == b"weights:image_embedding"


def test_profile_with_unknown_model_rejected(tmp_path: Path) -> None:
    manifests_dir = build_local_manifests(tmp_path)
    profile_path = manifests_dir / "profiles" / "default.yaml"
    data = yaml.safe_load(profile_path.read_text(encoding="utf-8"))
    data["steps"]["tagging"]["model"] = "missing-model"
    profile_path.write_text(yaml.safe_dump(data), encoding="utf-8")

    with pytest.raises(RegistryError, match="unknown model"):
        ModelRegistry.load(make_settings(tmp_path, manifests_dir))
