<p align="center">
  <img src="docs/assets/logo/logo.svg" alt="PINA logo" width="600">
</p>

# PINA — Private Image Network Archive

PINA is a self-hosted media gallery for private and group photo/video libraries.
The long-term product includes Spaces, local ML analysis, Telegram integration, and video support.
The backend is currently complete through **Phase 2**: JWT authentication, Google OIDC login,
ownership enforcement, Spaces with role-based access, subspace hierarchy, invite links, Space albums,
and favorites are implemented. The frontend is in active **Phase 3** implementation with the core SPA
shell, auth flows, library, timeline, batch photo upload UX, favorites, Spaces, invites, shared
albums, geo map browsing, search shell, and settings already wired to the backend. The frontend
quality layer now also includes a semantic design system, explicit light/dark theme switching,
shared UI primitives, accessibility automation, and browser-level responsive/visual regression tests.
The current frontend follow-up scope also includes a media-first web app redesign and baseline UI
localization for English and Russian.

The repository is organized as a monorepo. See [Milestones](MILESTONES.md) for current scope
and progress.

The project also includes [Backlog.md](backlog/) for operational task tracking. Use it for active
implementation work and task status, while `MILESTONES.md`, the PRD, and ADRs remain the primary
sources for roadmap, product scope, and architecture decisions.

## Quick Start

Backend only:

```bash
cd backend
./gradlew quarkusDev
```

Frontend SPA:

```bash
cd frontend
npm install
npm run dev
```

Compose setup:

```bash
docker compose -f docker/docker-compose.yml up --build
```

## Tech Stack

| Component | Current Status                            |
|-----------|-------------------------------------------|
| Backend   | Java 25, Quarkus, Gradle                  |
| Frontend  | React, React Router 7, Vite, Tailwind CSS; Phase 3 in progress with semantic theming, a11y automation, and Playwright responsive/visual regression checks |
| Database  | PostgreSQL 17 + pgvector                  |
| Storage   | Local FS implemented; S3/WebDAV stubbed   |
| ML        | Planned for Phase 4                       |
| Telegram  | Planned for Phase 5                       |
| Auth      | JWT + refresh tokens, cookie-backed browser sessions, Google OIDC |
| Deploy    | Compose for backend + PostgreSQL today    |

## Repository Structure

```text
pina/
├── backend/      Java + Quarkus backend
├── docker/       Dockerfiles and docker-compose.yml
├── docs/         PRD and ADRs
├── frontend/     React SPA client
├── ml/           Placeholder for future ML service
├── proto/        Placeholder for future gRPC contracts
├── tg-bot/       Placeholder for future Telegram bot
└── tg-mini-app/  Placeholder for future Telegram Mini App
```

## Source of Truth

- [Milestones](MILESTONES.md) — scope and progress
- [Backlog.md](backlog/) — active task tracking and execution backlog
- [Product Requirements](docs/product-requirements.adoc) — feature specifications
- [Architecture Decision Records](docs/adr.adoc) — technical decisions
- [Backend README](backend/README.md) — backend guide
- [Frontend README](frontend/README.md) — frontend guide

## License

[AGPL-3.0](LICENSE)
