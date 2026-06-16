---
id: TASK-058
title: >-
  ML-QA-001 Add type checking, coverage gate, and Dependabot updates for the ml
  module
status: Done
assignee:
  - '@claude'
created_date: '2026-06-12 14:58'
updated_date: '2026-06-16 08:56'
labels:
  - ml
  - ops
  - ci
milestone: m-3
dependencies: []
references:
  - backlog/tasks/task-050 - ML-EPIC-001-Deliver-Phase-4-ML-service-basic.md
documentation:
  - ml/README.md
  - .github/dependabot.yml
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bring the ml module's quality gates up to parity with the backend (Spotless/SpotBugs/JaCoCo) and frontend (ESLint/Prettier fail-on-warning): add a static type checker, enforce a test-coverage threshold, and include ml dependencies in automated Dependabot updates. Requested as follow-up to the Phase 4 ML epic (PR #49).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 mypy type checking passes with zero errors over the ml source and tests, excluding generated gRPC modules, and runs locally (make target) and in ML CI
- [x] #2 pytest enforces a coverage threshold (fail-under) measured over pina_ml, wired into make test and ML CI; generated code is excluded from accounting
- [x] #3 Dependabot is configured to update ml Python dependencies (uv.lock) with the same conventions as the existing ecosystems
- [x] #4 ml/README and CHANGELOG document the new gates and commands
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Type checker: mypy (pure-Python toolchain, pydantic mypy plugin) + types-PyYAML as dev deps. Config in pyproject: python 3.12, files=src/pina_ml+tests, check_untyped_defs, warn_unused_ignores, pydantic plugin; generated `pina.*` gRPC modules excluded via per-module override (ignore_missing_imports + follow_imports=skip) and untyped third parties (grpc, grpc_health, onnxruntime, tokenizers) via ignore_missing_imports. Fix all findings to zero. New `make typecheck` target + CI step in ml.yml.
2. Coverage gate: pytest-cov; pytest addopts `--cov=pina_ml --cov-report=term-missing --cov-fail-under=<threshold>`; threshold chosen from the measured baseline with a small margin (target parity with backend's 70 floor). Generated `pina/` is outside the measured package by construction; entrypoint-only code paths reviewed before resorting to pragmas. Runs in make test and therefore CI.
3. Dependabot: add `package-ecosystem: uv` for `/ml` mirroring existing conventions (weekly Monday, labels [dependencies, ml], commit prefix `deps(ml):`, PR limit 10).
4. Docs: ml/README commands + gates, ml/CHANGELOG entry. Finalize task, commit on feature/ml-service-integration, push (PR #49 picks it up).
Validation: make typecheck/lint/test green locally with the gate enforced; uv lock updated.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Delivered as planned. `pyproject` adds `mypy>=1.13`, `types-pyyaml>=6.0`, and
`pytest-cov>=6` (dev), the mypy config (python 3.12; pydantic plugin;
`check_untyped_defs`/`warn_unused_ignores`/`warn_redundant_casts`/
`no_implicit_optional`; generated `pina.*` excluded via `follow_imports=skip`;
untyped third parties ignored), and the pytest gate
`--cov=pina_ml --cov-report=term-missing --cov-fail-under=80` with branch
coverage and a `__main__` exclusion. `make typecheck` + a `Type check` CI step
added; the existing test step now enforces the gate. Dependabot gains a `uv`
ecosystem for `/ml` (weekly Monday, labels `[dependencies, ml]`, prefix
`deps(ml):`). A handful of source/test type-fixes (no behavioral change) bring
mypy to zero errors.

Local validation (uv 0.11.21): `mypy` clean over 27 files; `ruff check`/`format`
clean; `pytest` 28 passed with **88.57%** coverage (gate 80%); `uv sync
--frozen` and `uv lock --check` consistent.

Also bumped the transitive `starlette` 1.3.0 → 1.3.1 in `uv.lock` to clear
GHSA-82w8-qh3p-5jfq (HIGH), which the GitHub dependency-review gate began
flagging on PR #49; folded in here as the first ml dependency update.
<!-- SECTION:NOTES:END -->
