# Changelog — Frontend

All notable changes to the PINA frontend module will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Personal photo geo search data layer for bounding-box and nearby queries
- Library-integrated map browsing mode with URL-driven viewport state and interactive markers
- Client-side map clustering with cluster counts, drill-down UX, and geo selection polish

### Changed

- Library view switcher now includes a dedicated map mode without replacing existing list/timeline flows
- Framework decision: React + React Router 7 + Vite + Tailwind CSS
- Project scaffold with SPA mode, Tailwind CSS 4, TypeScript strict mode
- Vite dev proxy for `/api` to backend (localhost:8080)
- Root layout with error boundary and authenticated app shell
- Public landing page with backend health indicator
- Local login and registration flows with redirect-aware navigation
- Invite join route for authenticated invite acceptance
- Authenticated overview dashboard with recent photos and Space summary
- Personal library route with upload flow, timeline view, album management, and favorite toggles
- Personal photo detail view with metadata and favorite support
- Favorites route for saved photos and albums
- Spaces list and create flow
- Space detail route with members, subspaces, invites, albums, and shared photo navigation
- Space album photo detail route
- Profile settings route with update action
- Search route shell with URL-backed query state and lightweight local preview
- Shared frontend API client for auth, photos, albums, favorites, Spaces, invites, and profile flows
- Vitest + Testing Library frontend test setup with route-level coverage
- ESLint and Prettier quality gates integrated into frontend checks and builds

### Changed

- Frontend scope moved from placeholder pages to a real Phase 3 authenticated SPA
- `npm run build` now runs formatting, lint, and type checks before the production bundle
- Route tree expanded to cover the full app shell, library, favorites, Spaces, invite join, and settings flows
