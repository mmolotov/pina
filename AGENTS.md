# AGENTS.md

This file provides guidance to all AI Agents when working with code in this
repository.

## Key Documents

- [README.md](README.md) for project overview
- [backend/README.md](backend/README.md) for backend guide
- [frontend/README.md](frontend/README.md) for frontend guide
- [docs/product-requirements.adoc](docs/product-requirements.adoc) for feature specifications
- [docs/adr.adoc](docs/adr.adoc) for architecture decisions
- [MILESTONES.md](MILESTONES.md) for scope and progress

## Build & Test Commands

### Backend

```bash
cd backend
./gradlew quarkusDev          # dev mode with hot reload
./gradlew build                # build + test
./gradlew test                 # run tests only
./gradlew spotlessApply        # auto-format code
./gradlew spotlessCheck        # verify formatting
./gradlew spotbugsMain         # static analysis
```

### Frontend

```bash
cd frontend
npm install
npm run dev                    # dev server on :5173
npm run build                  # production build
npm run typecheck              # TypeScript check
```

## Project Conventions

- **Java 25 LTS** without `--enable-preview` or non-finalized features (ADR-LANG-001)
- **All code, comments, and documentation must be in English**
- **Responses in the chat sessions should be in the same language as a request**
- Backend uses **Quarkus** with Panache entities, Jakarta Validation, and `@Transactional` at service layer
- REST resources are thin; business logic lives in services
- Storage accessed only through `StorageProvider` SPI
- Database schema managed by **Flyway** migrations (source of truth for DDL)
- Code formatting enforced by **Spotless** (eclipse formatter); run `spotlessApply` before committing
- Tests are integration-style `@QuarkusTest` with REST Assured and real PostgreSQL via Dev Services
- Frontend uses **React + React Router 7 + Vite + Tailwind CSS** in SPA mode (no SSR)
- Authentication via **SmallRye JWT** (username/password); BCrypt hashing; `UserResolver` reads JWT subject
- **Spaces** with subspace hierarchy (adjacency list, max depth 5), role-based access (Owner > Admin > Member > Viewer)
- Current phase: **Phase 2 complete** (see MILESTONES.md) — all items done: JWT auth, Google OIDC, Spaces, role inheritance, visibility restrictions, invite links, Space albums, favorites
