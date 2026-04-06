# PINA Frontend

SPA client for PINA built with React, React Router 7, Vite, and Tailwind CSS.
The backend Phase 2 scope is complete, and the frontend now ships a real authenticated Phase 3
application shell instead of a placeholder scaffold.

Current implemented scope includes:

- public landing page with backend health probe
- local register/login flows with redirect-aware session bootstrap and support for both bearer-token
  auth and cookie-backed browser sessions
- authenticated dashboard, library, favorites, Spaces, settings, and invite join flows
- personal photo detail and Space album photo detail screens
- timeline grouping, album management, favorite toggles, and Space management UX
- geo search data layer and viewport-driven map browsing for personal photos, including
  filter-aware markers, clustering, and drill-down side panels
- route-level tests with Vitest and Testing Library

## Development

```bash
npm install         # Install dependencies
npm run dev         # Dev server with HMR at http://localhost:5173 and http://<your-ip>:5173
npm run format      # Prettier auto-format
npm run lint        # ESLint static analysis
npm run stylelint   # CSS static analysis
npm run check       # format check + lint + stylelint + typecheck
npm run build       # Production build (SPA, output in build/client/)
npm run typecheck   # TypeScript type checking
npm run test        # Vitest route and component tests
```

The dev server listens on all interfaces (`0.0.0.0`) so it is reachable both via `localhost`
and the machine's LAN IP. It proxies `/api` requests to the backend at `http://localhost:8080`.
In backend dev mode, CORS accepts arbitrary origins so login and API calls also work when the
frontend is opened through the machine's LAN IP.

## Project Structure

```
app/
├── app.css         # Global styles (Tailwind entry point)
├── components/     # Shared UI and app shell components
├── lib/            # API client, session store, route helpers
├── root.tsx        # Root layout (html shell, error boundary)
├── routes.ts       # Route definitions
├── routes/         # Route components (file-based routing)
├── test/           # Shared test setup
└── types/          # Shared DTO and API types
```

## Coding Conventions

### TypeScript

- Strict mode enabled, `verbatimModuleSyntax: true`
- Target ES2022, bundler module resolution
- Use path alias `~/` for `app/` imports (e.g. `import { Foo } from "~/components/foo"`)
- Prefer `interface` over `type` for object shapes; use `type` for unions and mapped types
- Use `unknown` instead of `any`; narrow with type guards
- Prefer named exports for components, default exports only for route modules
- Keep code comments and documentation in English

### React

- Functional components only — no class components
- Prefer `function` declarations over arrow functions for components
- Colocate component-specific files (styles, tests, types) next to the component
- Keep components small and focused; extract reusable parts into `app/components/`
- In SPA mode, prefer React Router `clientLoader` / `clientAction` for route data and mutations
- Keep optimistic local state only where route actions are a poor fit, such as file inputs or
  tightly scoped subresource refreshes

### Routing

- React Router 7 with file-based route config in `routes.ts`
- SPA mode (`ssr: false`) — all rendering happens client-side
- Type-safe routes via `react-router typegen`
- Route modules may export `meta`, `clientLoader`, `clientAction`, and a default component as needed
- The current route tree includes:
  - public landing, login, register, invite join
  - protected app shell, overview dashboard, library, photo viewer, search shell, favorites
  - Spaces list, Space detail, Space photo preview, settings

### Styling

- Tailwind CSS 4 with Vite plugin (no config file needed)
- Dark mode via `prefers-color-scheme` media query
- Use Tailwind utility classes directly in JSX — avoid separate CSS files per component
- For complex conditional classes, use template literals or a helper like `clsx`

### API Integration

- All backend calls go through `/api/v1/` — the Vite dev server proxies to `localhost:8080`
- Prefer React Router `clientLoader` / `clientAction` for route-level data fetching and mutations
- Keep API response types in a shared `app/types/` directory
- The frontend API layer already covers:
  - auth, profile, refresh, logout
  - personal photos, geo search, file blobs, albums, favorites
  - Spaces, members, subspaces, invites, Space albums, shared photo blobs

## Quality Gates

- `npm run format` uses Prettier for repo-local auto-formatting
- `npm run lint` runs ESLint over frontend source files
- `npm run stylelint` validates custom CSS in `app/**/*.css`
- `npm run test` runs Vitest route and component coverage in jsdom
- `npm run build` now includes `format:check`, `lint`, `stylelint`, and `typecheck` before the production build
- Current lint setup fails the build on warnings as well as errors

## Current Functional Scope

- Landing:
  - backend connectivity indicator
  - authenticated-user redirect into `/app`
- Auth:
  - local register/login
  - redirect-aware session bootstrap
  - bearer-token + refresh-token aware API client
  - compatibility with cookie-backed browser-session auth for web clients
- App shell:
  - protected navigation scaffold
  - authenticated overview dashboard with recent photos and accessible Spaces
- Library:
  - photo upload, batch upload UX, drag-and-drop queue
  - delete, favorite toggle, album CRUD, album photo management
  - filterable views for all items, photos, timeline, and albums
- Timeline:
  - day-grouped photo view based on `takenAt ?? createdAt`
- Map:
  - library-integrated geo browsing mode with URL-driven viewport state
  - viewport-based loading from backend bounding-box search
  - filter-aware marker rendering and empty states
  - client-side marker clustering for dense photo areas
  - cluster drill-down, clear-selection UX, and interactive markers that lead into existing photo
    detail routes
- Viewer:
  - personal photo preview with metadata and favorite toggle
  - shared Space album photo preview
- Search:
  - route shell, query state in URL, scope toggles, lightweight client-side preview
  - backend-powered semantic/tag/face search not connected yet
- Favorites:
  - combined photo and album favorites view
- Spaces:
  - list and create root Spaces
  - Space detail with members, subspaces, invites, albums, and album-photo flows
- Settings:
  - profile update with in-memory session sync
- Invite flow:
  - invite preview and authenticated join handling
- Responsive baseline:
  - mobile navigation and mobile-friendly detail screens

Not implemented yet in the frontend:

- Video playback and video upload UI
- Search backend integration and real semantic results
- Real admin panel, pending backend admin APIs
