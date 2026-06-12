from pathlib import Path

import pytest

from pina_ml.config import RuntimeProfile, Settings
from pina_ml.registry import ModelRegistry, PipelineStep


def load_registry(profile: RuntimeProfile, tmp_path: Path) -> ModelRegistry:
    return ModelRegistry.load(Settings(profile=profile, model_cache_dir=tmp_path / "cache"))


@pytest.mark.parametrize("profile", [RuntimeProfile.DEFAULT, RuntimeProfile.CPU_LITE])
def test_packaged_profile_covers_all_steps(profile: RuntimeProfile, tmp_path: Path) -> None:
    registry = load_registry(profile, tmp_path)
    assert [step for step, _ in registry.required()] == list(PipelineStep)
    for _, manifest in registry.required():
        assert manifest.files


def test_profiles_select_different_models_and_limits(tmp_path: Path) -> None:
    default = load_registry(RuntimeProfile.DEFAULT, tmp_path)
    lite = load_registry(RuntimeProfile.CPU_LITE, tmp_path)

    default_models = {manifest.id for _, manifest in default.required()}
    lite_models = {manifest.id for _, manifest in lite.required()}
    assert default_models.isdisjoint(lite_models)

    assert lite.profile.max_parallel_analyses < default.profile.max_parallel_analyses
    assert lite.profile.analysis_max_resolution < default.profile.analysis_max_resolution


def test_insightface_models_are_license_flagged(tmp_path: Path) -> None:
    registry = load_registry(RuntimeProfile.DEFAULT, tmp_path)
    flagged = {
        manifest.id for _, manifest in registry.required() if not manifest.license.commercial_use
    }
    assert flagged == {"scrfd-10g", "arcface-w600k-r50"}

    warnings = registry.license_warnings()
    for model_id in flagged:
        assert any(model_id in warning for warning in warnings)
