# Changelog

All notable changes to the PINA project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

For module-specific changes, see changelogs in each module directory.

## [Unreleased]

### Phase 2: Auth + Spaces
- JWT authentication with refresh token rotation, Google OIDC login
- Spaces with role-based access, subspace hierarchy, invite links
- Space albums, favorites, ownership enforcement
- See [backend/CHANGELOG.md](backend/CHANGELOG.md) for detailed changes

### Phase 1: Foundation
- Monorepo structure, CI, product requirements, ADRs
- Backend: photo upload pipeline, albums, storage SPI, OpenAPI
- Frontend skeleton (React + Vite + Tailwind)
- AGPL-3.0 license
