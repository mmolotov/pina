---
name: preflight
description: Run the full local CI gate (backend spotless + build + spotbugs + coverage, frontend check + tests) before opening a PR. Mirrors what GitHub Actions enforces, so green here means green in CI.
disable-model-invocation: true
---

# Preflight

Reproduce the GitHub Actions gates locally so failures surface before the PR, not after.
Run only the side that changed (use `git status` to decide); run both if unsure.

## Backend (from `backend/`)

```bash
./gradlew spotlessCheck build spotbugsMain jacocoTestCoverageVerification
```

- `spotlessCheck` — formatting (fix with `./gradlew spotlessApply`)
- `build` — compile + all `@QuarkusTest` tests (Docker must be running for Dev Services)
- `spotbugsMain` — static analysis
- `jacocoTestCoverageVerification` — coverage threshold (CI requires ≥70%)

## Frontend (from `frontend/`)

```bash
npm run check && npm run test
```

- `check` = format:check + lint (`--max-warnings=0`) + stylelint + `guard:design` + typecheck
- `test` = Vitest unit/route/component tests
- For visual regression too: `npm run test:e2e` (slower — Playwright)

## ML service (from `ml/`)

```bash
make lint typecheck test
```

- `lint` = ruff check + ruff format check
- `typecheck` = mypy (regenerates gRPC modules first)
- `test` = pytest with the 80% branch-coverage gate (regenerates gRPC modules first)
- Requires `uv` on PATH; the `make` targets wrap `uv run`.

## Reporting

After running, report concisely:
- A ✓/✗ per gate with the failing command and the one-line fix.
- For test failures, name the failing test(s); do not dump full logs.
- End with an explicit verdict: **safe to push** or **blocked by N gate(s)**.
