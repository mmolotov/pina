# PINA Frontend

SPA client for PINA built with React, React Router 7, Vite, and Tailwind CSS.
The backend Phase 2 scope is complete, and the frontend now ships a real authenticated Phase 3
application shell instead of a placeholder scaffold.

Current implemented scope includes:

- public landing page with backend health probe
- local register/login flows with redirect-aware session bootstrap and support for both bearer-token
  auth and cookie-backed browser sessions
- authenticated dashboard, library, favorites, Spaces, settings, and invite join flows
- explicit light/dark theme switching with persisted preference and semantic theme tokens
- personal photo detail and Space album photo detail screens
- timeline grouping, album management, favorite toggles, and Space management UX
- geo search data layer and viewport-driven map browsing for personal photos, including
  filter-aware markers, clustering, and drill-down side panels
- route-level tests with Vitest and Testing Library
- automated accessibility baseline with `eslint-plugin-jsx-a11y` and route-level `jest-axe` smoke checks
- shared UI primitives for cards, inline feedback, empty hints, and filter toolbars backed by the design system

The next Phase 3 UI pass is focused on a media-first shell redesign for the authenticated app and
baseline localization for English and Russian.

## Development

```bash
npm install         # Install dependencies
npm run dev         # Dev server with HMR at http://localhost:5173 and http://<your-ip>:5173
npm run format      # Prettier auto-format
npm run guard:design # Style-guide conformance guard for raw color drift
npm run lint        # ESLint static analysis
npm run stylelint   # CSS static analysis
npm run check       # format check + lint + stylelint + design guard + typecheck
npm run build       # Production build (SPA, output in build/client/)
npm run typecheck   # TypeScript type checking
npm run test        # Vitest route and component tests
npm run test:e2e    # Playwright responsive + visual regression suite
npm run test:e2e:update # Regenerate Playwright baseline screenshots
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
├── docs/           # Frontend design and implementation guides
├── lib/            # API client, session store, i18n/theme providers, route helpers
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
- Prefer shared UI primitives from `app/components/ui.tsx` before introducing new route-local
  panel, feedback, empty-state, or filter-bar shells

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
- Global theme tokens and reusable visual utilities live in `app/app.css`
- Use semantic tokens and shared utility classes before introducing route-local color combinations
- Light and dark themes share the same semantic token names, and the current app shell includes an explicit theme switcher with persisted preference
- Follow the design rules in [`docs/design-system.md`](./docs/design-system.md)
- Prefer shared primitives such as `SurfaceCard`, `InlineMessage`, `EmptyHint`, and `FilterToolbar`
  before creating route-local layout or feedback patterns
- Use Tailwind utility classes directly in JSX for layout and spacing; keep color/state decisions tied to semantic tokens

### Localization

- New user-facing strings should come from a shared localization layer instead of route-local hard-coded copy
- The initial supported UI locales are English (`en`) and Russian (`ru`), with English fallback
- Date, time, and relative-count formatting should follow the active locale
- The shared locale state, catalogs, bootstrap script, and `useI18n()` hook live in `app/lib/i18n.tsx`
- The shared shell language switcher lives in `app/components/language-switcher.tsx`
- Formatting helpers in `app/lib/format.ts` are locale-aware and should be preferred over ad-hoc `Intl` usage inside routes

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
- `npm run guard:design` blocks obvious style drift such as raw color literals outside `app/app.css`
- `npm run test` runs Vitest route, component, and accessibility smoke coverage in jsdom
- `npm run test:e2e` runs Playwright browser-level responsive smoke and screenshot regression checks
- `npm run build` now includes `format:check`, `lint`, `stylelint`, and `typecheck` before the production build
- Current lint setup fails the build on warnings as well as errors
- Accessibility failures surface through the normal lint and test pipeline
- Browser-level responsive and visual regression coverage now runs through Playwright as a blocking frontend CI gate
- Frontend CI now treats `check`, Vitest, and Playwright route smoke as blocking UI gates
- Normal UI work should also follow [`docs/design-system.md`](./docs/design-system.md)

## Responsive and Visual Regression Coverage

Current Playwright route coverage:

- Routes:
  - `/login`
  - `/app`
  - `/app/library`
- Viewports:
  - desktop `1280x800`
  - tablet `768x1024`
  - mobile `390x844`

The browser suite currently checks:

- no horizontal overflow on the covered routes
- reachability of the primary actions and navigation controls
- screenshot regressions for each covered route and viewport

Playwright starts a fresh `vite preview` server for each run and uses
viewport-specific snapshot names that are stable across operating systems.

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
  - light/dark theme switching via semantic tokens

Not implemented yet in the frontend:

- Video playback and video upload UI
- Search backend integration and real semantic results
- Real admin panel, pending backend admin APIs
- Media-first authenticated shell redesign with left rail navigation, top search/filter controls, and a prominent Upload action
- Basic UI localization for English and Russian
