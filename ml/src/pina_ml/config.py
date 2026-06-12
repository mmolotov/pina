from __future__ import annotations

from enum import StrEnum
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class RuntimeProfile(StrEnum):
    """Deployment profiles; cpu-lite targets weak self-hosted hardware."""

    DEFAULT = "default"
    CPU_LITE = "cpu-lite"


class Settings(BaseSettings):
    """Runtime configuration.

    Every field is overridable through ``PINA_ML_*`` environment variables;
    list values use JSON, e.g.
    ``PINA_ML_EXECUTION_PROVIDERS='["CPUExecutionProvider"]'``.
    """

    model_config = SettingsConfigDict(
        env_prefix="PINA_ML_", protected_namespaces=(), extra="ignore"
    )

    grpc_host: str = "0.0.0.0"
    grpc_port: int = 50051
    http_host: str = "0.0.0.0"
    http_port: int = 8000
    model_cache_dir: Path = Path("models")
    profile: RuntimeProfile = RuntimeProfile.DEFAULT
    execution_providers: list[str] = ["CPUExecutionProvider"]
    log_level: str = "INFO"
