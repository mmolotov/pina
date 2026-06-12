"""Per-step latency benchmark for the active runtime profile.

Usage (from ml/):
    PINA_ML_PROFILE=cpu-lite uv run python scripts/benchmark.py <image> [iterations]

Downloads the active profile's models into the cache if needed, runs one
warmup pass (lazy session loads + vocabulary embedding), then measures
``iterations`` full analyses and prints a per-step latency matrix.
"""

from __future__ import annotations

import asyncio
import statistics
import sys
import time
from collections import defaultdict
from pathlib import Path

from pina_ml.config import Settings
from pina_ml.pipeline import PhotoAnalysisPipeline, StepState
from pina_ml.registry import ModelRegistry


def percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round(fraction * (len(ordered) - 1))))
    return ordered[index]


async def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    image_path = Path(sys.argv[1])
    iterations = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    image_bytes = image_path.read_bytes()

    settings = Settings()
    registry = ModelRegistry.load(settings)
    print(
        f"profile={registry.profile.name}"
        f" max_parallel_analyses={registry.profile.max_parallel_analyses}"
        f" analysis_max_resolution={registry.profile.analysis_max_resolution}"
    )
    await registry.ensure_all()
    pipeline = PhotoAnalysisPipeline(settings, registry)

    warmup_started = time.perf_counter()
    warmup = await pipeline.analyze(image_bytes, [])
    warmup_ms = (time.perf_counter() - warmup_started) * 1000
    failed = [o for o in warmup.outcomes if o.state is not StepState.COMPLETED]
    if failed:
        for outcome in failed:
            print(f"FAILED {outcome.step.value}: {outcome.error}")
        return 1
    print(f"warmup (cold sessions + vocabulary): {warmup_ms:.0f} ms\n")

    step_durations: dict[str, list[float]] = defaultdict(list)
    step_models: dict[str, str] = {}
    totals: list[float] = []
    for _ in range(iterations):
        started = time.perf_counter()
        result = await pipeline.analyze(image_bytes, [])
        totals.append((time.perf_counter() - started) * 1000)
        for outcome in result.outcomes:
            step_durations[outcome.step.value].append(float(outcome.duration_ms))
            if outcome.manifest is not None:
                step_models[outcome.step.value] = (
                    f"{outcome.manifest.id}@{outcome.manifest.version}"
                )

    print(f"{'step':<18} {'model':<28} {'mean':>8} {'p50':>8} {'p95':>8}")
    for step, durations in step_durations.items():
        model = step_models.get(step, "-")
        print(
            f"{step:<18} {model:<28} {statistics.fmean(durations):>7.0f}ms"
            f" {percentile(durations, 0.5):>7.0f}ms {percentile(durations, 0.95):>7.0f}ms"
        )
    mean_total = statistics.fmean(totals)
    print(
        f"{'TOTAL':<18} {'(end-to-end wall)':<28} {mean_total:>7.0f}ms"
        f" {percentile(totals, 0.5):>7.0f}ms {percentile(totals, 0.95):>7.0f}ms"
    )
    print(
        f"\nserial throughput: {1000.0 / mean_total:.2f} photos/s"
        f" (single worker; profile allows {registry.profile.max_parallel_analyses} parallel)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
