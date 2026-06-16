from __future__ import annotations

from pathlib import Path

import yaml

from pina_ml.registry import PipelineStep


def build_local_manifests(base_dir: Path) -> Path:
    """Creates a manifests dir with one tiny local-file model per step plus a
    `default` profile override referencing them."""
    manifests_dir = base_dir / "manifests"
    models_dir = manifests_dir / "models"
    profiles_dir = manifests_dir / "profiles"
    models_dir.mkdir(parents=True)
    profiles_dir.mkdir(parents=True)
    artifacts_dir = base_dir / "artifacts"
    artifacts_dir.mkdir()

    steps: dict[str, dict[str, str]] = {}
    for step in PipelineStep:
        model_id = f"test-{step.value.replace('_', '-')}"
        artifact = artifacts_dir / f"{model_id}.onnx"
        artifact.write_bytes(b"weights:" + step.value.encode())
        manifest = {
            "id": model_id,
            "version": "1.0",
            "step": step.value,
            "license": {"spdx": "MIT"},
            "files": [{"name": f"{model_id}.onnx", "url": artifact.as_uri()}],
        }
        (models_dir / f"{model_id}.yaml").write_text(yaml.safe_dump(manifest), encoding="utf-8")
        steps[step.value] = {"model": model_id}

    profile = {
        "name": "default",
        "max_parallel_analyses": 1,
        "analysis_max_resolution": 640,
        "steps": steps,
    }
    (profiles_dir / "default.yaml").write_text(yaml.safe_dump(profile), encoding="utf-8")
    return manifests_dir
