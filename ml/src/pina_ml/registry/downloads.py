from __future__ import annotations

import asyncio
import hashlib
import logging
import shutil
import zipfile
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import url2pathname

import httpx

from pina_ml.registry.manifest import ArtifactSpec

LOG = logging.getLogger(__name__)

# Generous read timeout: model CDNs can stall between chunks on large files.
_DOWNLOAD_TIMEOUT = httpx.Timeout(connect=15.0, read=300.0, write=120.0, pool=60.0)

# Upper bound on a single fetched artifact. Comfortably above real model/pack
# sizes (CLIP ~350 MB, InsightFace packs ~300 MB) while bounding a hostile or
# misconfigured URL so it cannot exhaust the model-cache disk.
_MAX_ARTIFACT_BYTES = 2 * 1024**3


class ArtifactError(RuntimeError):
    """Raised when an artifact cannot be fetched or fails validation."""


class ArtifactDownloader:
    """Fetches model artifacts into the persistent cache.

    Cache layout: ``<cache>/models/<id>/<version>/<name>`` for artifacts and
    ``<cache>/archives/<url-digest>.zip`` for source archives shared by
    several models (e.g. InsightFace packs).
    """

    def __init__(self, cache_dir: Path) -> None:
        self._cache_dir = cache_dir
        self._lock = asyncio.Lock()

    def artifact_path(self, model_id: str, version: str, artifact: ArtifactSpec) -> Path:
        return self._cache_dir / "models" / model_id / version / artifact.name

    def is_cached(self, model_id: str, version: str, artifact: ArtifactSpec) -> bool:
        path = self.artifact_path(model_id, version, artifact)
        return path.is_file() and path.stat().st_size > 0

    async def ensure(self, model_id: str, version: str, artifact: ArtifactSpec) -> Path:
        """Returns the cached artifact path, downloading it when missing."""
        path = self.artifact_path(model_id, version, artifact)
        if self.is_cached(model_id, version, artifact):
            return path
        async with self._lock:
            if self.is_cached(model_id, version, artifact):
                return path
            if artifact.sha256 is None and urlparse(artifact.url).scheme in ("http", "https"):
                LOG.warning(
                    "Artifact %s/%s/%s has no sha256 in its manifest; fetching %s unverified",
                    model_id,
                    version,
                    artifact.name,
                    artifact.url,
                )
            path.parent.mkdir(parents=True, exist_ok=True)
            part = path.with_name(path.name + ".part")
            try:
                if artifact.archive is not None:
                    archive_path = await self._ensure_archive(artifact.url)
                    await asyncio.to_thread(
                        _extract_member, archive_path, artifact.archive.member, part
                    )
                else:
                    await self._fetch_url(artifact.url, part)
                _verify_sha256(part, artifact.sha256)
                part.replace(path)
            finally:
                part.unlink(missing_ok=True)
            LOG.info("Cached model artifact %s/%s/%s", model_id, version, artifact.name)
            return path

    async def _ensure_archive(self, url: str) -> Path:
        digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]
        archive_path = self._cache_dir / "archives" / f"{digest}.zip"
        if archive_path.is_file() and archive_path.stat().st_size > 0:
            return archive_path
        archive_path.parent.mkdir(parents=True, exist_ok=True)
        part = archive_path.with_name(archive_path.name + ".part")
        try:
            await self._fetch_url(url, part)
            part.replace(archive_path)
        finally:
            part.unlink(missing_ok=True)
        return archive_path

    async def _fetch_url(self, url: str, dest: Path) -> None:
        scheme = urlparse(url).scheme
        if scheme == "file":
            source = Path(url2pathname(urlparse(url).path))
            if not source.is_file():
                raise ArtifactError(f"Local artifact not found: {url}")
            await asyncio.to_thread(shutil.copyfile, source, dest)
            return
        if scheme not in ("http", "https"):
            raise ArtifactError(f"Unsupported artifact URL scheme: {url}")
        LOG.info("Downloading %s", url)
        async with (
            httpx.AsyncClient(follow_redirects=True, timeout=_DOWNLOAD_TIMEOUT) as client,
            client.stream("GET", url) as response,
        ):
            if response.status_code != 200:
                raise ArtifactError(f"Download failed with HTTP {response.status_code}: {url}")
            declared = response.headers.get("content-length")
            if declared is not None and declared.isdigit() and int(declared) > _MAX_ARTIFACT_BYTES:
                raise ArtifactError(
                    f"Artifact at {url} exceeds the {_MAX_ARTIFACT_BYTES}-byte "
                    f"cap (declares {declared} bytes)"
                )
            written = 0
            with dest.open("wb") as handle:
                async for chunk in response.aiter_bytes():
                    written += len(chunk)
                    if written > _MAX_ARTIFACT_BYTES:
                        raise ArtifactError(
                            f"Artifact exceeds the {_MAX_ARTIFACT_BYTES}-byte cap: {url}"
                        )
                    handle.write(chunk)


def _extract_member(archive_path: Path, member: str, dest: Path) -> None:
    with zipfile.ZipFile(archive_path) as archive:
        names = archive.namelist()
        resolved = member if member in names else _match_by_basename(names, member)
        with archive.open(resolved) as source, dest.open("wb") as handle:
            shutil.copyfileobj(source, handle)


def _match_by_basename(names: list[str], member: str) -> str:
    """Resolves a member by basename so packs with a top-level folder work."""
    matches = [name for name in names if Path(name).name == member]
    if len(matches) != 1:
        raise ArtifactError(
            f"Archive member {member!r} not found unambiguously; candidates: {matches}"
        )
    return matches[0]


def _verify_sha256(path: Path, expected: str | None) -> None:
    if expected is None:
        return
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    actual = digest.hexdigest()
    if actual != expected.lower():
        raise ArtifactError(f"SHA-256 mismatch for {path.name}: expected {expected}, got {actual}")
