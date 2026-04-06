# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Key Documents

- [backend/README.md](backend/README.md) for backend API reference and domain model
- [frontend/README.md](frontend/README.md) for frontend conventions and functional scope
- [docs/product-requirements.adoc](docs/product-requirements.adoc) for feature specifications
- [docs/adr.adoc](docs/adr.adoc) for architecture decisions
- [MILESTONES.md](MILESTONES.md) for scope and progress

## Build & Test Commands

### Backend (from `backend/`)

```bash
./gradlew quarkusDev                                        # dev mode with hot reload
./gradlew build                                             # build + test
./gradlew test                                              # run all tests
./gradlew test --tests "dev.pina.backend.api.PhotoResourceTest"  # run single test class
./gradlew spotlessApply                                     # auto-format (run before committing)
./gradlew spotlessCheck                                     # verify formatting
./gradlew spotbugsMain                                      # static analysis
```

JWT keys must exist before running (not in repo):
```bash
mkdir -p dev-keys
openssl genrsa -out dev-keys/privateKey.pem 2048
openssl rsa -in dev-keys/privateKey.pem -pubout -out dev-keys/publicKey.pem
```

Dev endpoints: API at `:8080/api/v1/`, Swagger UI at `:8080/q/swagger-ui`, Health at `:8080/q/health`

### Frontend (from `frontend/`)

```bash
npm install
npm run dev          # dev server on :5173, proxies /api to :8080
npm run build        # format:check + lint + stylelint + typecheck + production build
npm run check        # format check + lint + stylelint + typecheck (no build)
npm run test         # Vitest route and component tests
npm run typecheck    # TypeScript only
npm run format       # Prettier auto-format
npm run lint         # ESLint (warnings fail)
npm run stylelint    # CSS linting
```

### Docker Compose

```bash
docker compose -f docker/docker-compose.yml up --build
```

## Project Conventions

- **Java 25 LTS** — only finalized features, no `--enable-preview` (ADR-LANG-001)
- **All code, comments, and documentation in English**; chat responses match the user's language
- Backend formatting enforced by **Spotless** (eclipse); run `spotlessApply` before committing
- Frontend lint setup **fails on warnings** — fix all warnings before committing
- REST resources are thin controllers; business logic lives in `service/` classes
- Storage accessed only through `StorageProvider` SPI
- Database schema managed by **Flyway** migrations (source of truth for DDL)
- Tests are integration-style `@QuarkusTest` with REST Assured and real PostgreSQL via Dev Services (Docker required)
- Frontend uses path alias `~/` for `app/` imports
- Frontend prefers `clientLoader`/`clientAction` for route data; SPA mode only (no SSR)

## Architecture Overview

**Monorepo** with backend, frontend, and placeholder modules (ml, proto, tg-bot, tg-mini-app).

### Backend (Java 25 + Quarkus)

Package layout under `dev.pina.backend/`:
- `api/` — REST resources (thin), `api/dto/` — request/response DTOs
- `service/` — business logic (`AuthService`, `PhotoService`, `AlbumService`, `SpaceService`, `InviteLinkService`, `FavoriteService`, `BrowserSessionService`, `UserResolver`)
- `domain/` — Panache entities
- `storage/` — storage SPI + provider implementations
- `config/` — typed config mappings

Auth model: JWT (SmallRye) + refresh tokens for API clients; cookie-backed browser sessions for web. `UserResolver` abstracts both. Google OIDC supported via jose4j JWKS verification.

Key domain relationships:
- `User` → `LinkedAccount` (multi-provider: LOCAL, GOOGLE, TELEGRAM)
- `User` → `PersonalLibrary` (auto-created) → `Photo` + `Album`
- `Album` → `AlbumPhoto` (references, not copies)
- `Space` → `SpaceMembership` (roles: Owner > Admin > Member > Viewer) → subspace hierarchy (adjacency list, max depth 5) with `inheritMembers` visibility and `getEffectiveRole()` parent-chain walk
- `Space` → `InviteLink` (expiration, usage limits, atomic join)
- `User` → `Favorite` (photos and albums)

Upload pipeline: multipart stream → temp file → SHA-256 dedup (per-uploader) → EXIF extraction → variants (original/compressed/thumbnails) → paths keyed by photo.id.

Test helpers: `TestAuthHelper` (REST-based JWT), `TestUserHelper` (direct DB setup).

### Frontend (React + React Router 7 + Vite + Tailwind CSS 4)

- SPA mode (`ssr: false`), file-based routing in `routes.ts`
- `app/lib/` — API client, session store, route helpers
- `app/components/` — shared UI components
- `app/routes/` — route modules with `clientLoader`/`clientAction`
- `app/types/` — shared DTO types
- Type-safe routes via `react-router typegen`

### Current Phase

Phase 2 (backend) complete. Phase 3 (frontend) nearly complete — remaining: search backend integration, admin panel. See [MILESTONES.md](MILESTONES.md).

<!-- BACKLOG.MD MCP GUIDELINES START -->

<CRITICAL_INSTRUCTION>

## BACKLOG WORKFLOW INSTRUCTIONS

This project uses Backlog.md MCP for all task and project management activities.

**CRITICAL GUIDANCE**

- If your client supports MCP resources, read `backlog://workflow/overview` to understand when and how to use Backlog for this project.
- If your client only supports tools or the above request fails, call `backlog.get_backlog_instructions()` to load the tool-oriented overview. Use the `instruction` selector when you need `task-creation`, `task-execution`, or `task-finalization`.

- **First time working here?** Read the overview resource IMMEDIATELY to learn the workflow
- **Already familiar?** You should have the overview cached ("## Backlog.md Overview (MCP)")
- **When to read it**: BEFORE creating tasks, or when you're unsure whether to track work

These guides cover:
- Decision framework for when to create tasks
- Search-first workflow to avoid duplicates
- Links to detailed guides for task creation, execution, and finalization
- MCP tools reference

You MUST read the overview resource to understand the complete workflow. The information is NOT summarized here.

</CRITICAL_INSTRUCTION>

<!-- BACKLOG.MD MCP GUIDELINES END -->
