<p align="center">
  <img src="docs/assets/logo/logo.svg" alt="PINA logo" width="600">
</p>

# PINA — Private Image Network Archive

PINA is a self-hosted media gallery for private and group photo/video libraries.
The long-term product includes Spaces, local ML analysis, Telegram integration, and video support.
The repository is currently at **Phase 1**: backend MVP foundation plus a frontend skeleton.

The repository is organized as a monorepo. See [Milestones](MILESTONES.md) for current scope
and progress.

## Quick Start

Backend only:

```bash
cd backend
./gradlew quarkusDev
```

Frontend skeleton:

```bash
cd frontend
npm install
npm run dev
```

Compose setup for current Phase 1 deployment target:

```bash
docker compose -f docker/docker-compose.yml up --build
```

## Tech Stack

| Component | Current Status                            |
|-----------|-------------------------------------------|
| Backend   | Java 25, Quarkus, Gradle                  |
| Frontend  | React, React Router 7, Vite, Tailwind CSS |
| Database  | PostgreSQL 17 + pgvector                  |
| Storage   | Local FS implemented; S3/WebDAV stubbed   |
| ML        | Planned for Phase 3                       |
| Telegram  | Planned for Phase 5                       |
| Auth      | Planned for Phase 2                       |
| Deploy    | Compose for backend + PostgreSQL today    |

## Repository Structure

```text
pina/
├── backend/      Java + Quarkus backend
├── docker/       Dockerfiles and docker-compose.yml
├── docs/         PRD and ADRs
├── frontend/     React frontend skeleton
├── ml/           Placeholder for future ML service
├── proto/        Placeholder for future gRPC contracts
├── tg-bot/       Placeholder for future Telegram bot
└── tg-mini-app/  Placeholder for future Telegram Mini App
```

## Source of Truth

- [Milestones](MILESTONES.md) — scope and progress
- [Product Requirements](docs/product-requirements.adoc) — feature specifications
- [Architecture Decision Records](docs/adr.adoc) — technical decisions
- [Backend README](backend/README.md) — backend guide
- [Frontend README](frontend/README.md) — frontend guide

## License

[AGPL-3.0](LICENSE)
