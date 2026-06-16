"""One-shot real-model smoke: downloads the active profile's models and runs
one full pipeline pass over a local image file.

Usage (from ml/):
    PINA_ML_PROFILE=cpu-lite uv run python scripts/real_model_smoke.py <image>

Configuration comes from the usual PINA_ML_* environment variables; models are
cached in PINA_ML_MODEL_CACHE_DIR (default ./models, git-ignored).
"""

from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

from pina_ml.config import Settings
from pina_ml.pipeline import PhotoAnalysisPipeline, StepState
from pina_ml.registry import ModelRegistry


async def main() -> int:
    logging.basicConfig(level="INFO", format="%(levelname)s %(name)s %(message)s")
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    image_path = Path(sys.argv[1])

    settings = Settings()
    registry = ModelRegistry.load(settings)
    for warning in registry.license_warnings():
        print(f"LICENSE: {warning}")
    print(f"profile={registry.profile.name} cache={settings.model_cache_dir}")
    await registry.ensure_all()

    pipeline = PhotoAnalysisPipeline(settings, registry)
    result = await pipeline.analyze(image_path.read_bytes(), [])

    for outcome in result.outcomes:
        model = (
            f" model={outcome.manifest.id}@{outcome.manifest.version}" if outcome.manifest else ""
        )
        error = f" error={outcome.error}" if outcome.error else ""
        print(
            f"{outcome.step.value}: {outcome.state.value} ({outcome.duration_ms} ms){model}{error}"
        )
    if result.image_embedding is not None:
        print(f"image_embedding: dim={len(result.image_embedding)}")
    tags = ", ".join(f"{tag.label}={tag.confidence:.3f}" for tag in result.tags)
    print(f"tags: {tags or '(none)'}")
    print(f"faces: {len(result.faces)}")
    for face in result.faces:
        descriptor_dim = len(face.embedding) if face.embedding else 0
        print(
            f"  box=({face.x:.3f},{face.y:.3f},{face.width:.3f},{face.height:.3f})"
            f" conf={face.confidence:.3f} descriptor_dim={descriptor_dim}"
        )

    failed = [outcome for outcome in result.outcomes if outcome.state is not StepState.COMPLETED]
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
