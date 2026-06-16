from pathlib import Path

from pina_ml.config import RuntimeProfile, Settings


def test_defaults() -> None:
    settings = Settings()
    assert settings.grpc_port == 50051
    assert settings.http_port == 8000
    assert settings.profile is RuntimeProfile.DEFAULT
    assert settings.execution_providers == ["CPUExecutionProvider"]
    assert settings.model_cache_dir == Path("models")
    assert settings.log_level == "INFO"


def test_env_overrides(monkeypatch) -> None:
    monkeypatch.setenv("PINA_ML_GRPC_PORT", "6001")
    monkeypatch.setenv("PINA_ML_PROFILE", "cpu-lite")
    monkeypatch.setenv(
        "PINA_ML_EXECUTION_PROVIDERS", '["OpenVINOExecutionProvider", "CPUExecutionProvider"]'
    )
    monkeypatch.setenv("PINA_ML_MODEL_CACHE_DIR", "/models")

    settings = Settings()

    assert settings.grpc_port == 6001
    assert settings.profile is RuntimeProfile.CPU_LITE
    assert settings.execution_providers == ["OpenVINOExecutionProvider", "CPUExecutionProvider"]
    assert settings.model_cache_dir == Path("/models")
