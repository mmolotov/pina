# PINA Frontend

SPA client for PINA built with React, React Router 7, Vite, and Tailwind CSS.
Current repository status: Phase 1 skeleton only.

## Development

```bash
npm install         # Install dependencies
npm run dev         # Dev server with HMR at http://localhost:5173
npm run build       # Production build (SPA, output in build/client/)
npm run typecheck   # TypeScript type checking
```

The dev server currently proxies `/api` requests to the backend at `http://localhost:8080`.

## Project Structure

```
app/
├── app.css         # Global styles (Tailwind entry point)
├── root.tsx        # Root layout (html shell, error boundary)
├── routes.ts       # Route definitions
└── routes/         # Route components (file-based routing)
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
- Prefer React Router's `loader`/`action` for route data fetching as the frontend grows
- The current Phase 1 home route is a minimal skeleton and uses `useEffect` for a health check

### Routing

- React Router 7 with file-based route config in `routes.ts`
- SPA mode (`ssr: false`) — all rendering happens client-side
- Type-safe routes via `react-router typegen`
- Route modules may export `meta`, `loader`, `action`, and a default component as needed

### Styling

- Tailwind CSS 4 with Vite plugin (no config file needed)
- Dark mode via `prefers-color-scheme` media query
- Use Tailwind utility classes directly in JSX — avoid separate CSS files per component
- For complex conditional classes, use template literals or a helper like `clsx`

### API Integration

- All backend calls go through `/api/v1/` — the Vite dev server proxies to `localhost:8080`
- Prefer React Router `loader`/`action` functions for data fetching and mutations in non-trivial routes
- Keep API response types in a shared `app/types/` directory
