# PINA Frontend Design System

This document defines the practical UI rules for the current frontend. It is
intentionally short, implementation-oriented, and tied to the existing
React Router SPA.

## Theme Foundation

- Brand palette tokens live in [`app/app.css`](../app/app.css).
- UI code should prefer semantic tokens over brand tokens.
- Light theme is the current default.
- Dark theme already has a token foundation and must reuse the same semantic
  names instead of introducing route-specific overrides.

### Brand Tokens

Use brand tokens only inside the global theme layer:

- `--brand-navy`
- `--brand-cyan`
- `--brand-lime`
- `--brand-lime-strong`
- `--brand-violet`
- `--brand-success`

### Semantic Tokens

Use semantic tokens in components and routes:

- Surfaces:
  - `--color-bg`
  - `--color-surface`
  - `--color-surface-strong`
  - `--color-surface-subtle`
  - `--color-surface-canvas`
- Text:
  - `--color-text`
  - `--color-text-muted`
- Borders:
  - `--color-border`
  - `--color-border-strong`
- Actions:
  - `--color-accent`
  - `--color-accent-strong`
  - `--color-accent-soft`
  - `--color-link`
  - `--color-link-hover`
- Feedback:
  - `--color-success`
  - `--color-success-strong`
  - `--color-success-soft`
  - `--color-danger`
  - `--color-danger-strong`
  - `--color-danger-soft`

## Shared Utility Classes

Routes should prefer shared utility classes from [`app/app.css`](../app/app.css)
before introducing new ad hoc combinations.

- Surfaces:
  - `panel`
  - `surface-card`
  - `surface-card-subtle`
  - `surface-dashed`
- Navigation:
  - `nav-link`
  - `nav-link-active`
  - `nav-link-idle`
- Actions and status:
  - `button-primary`
  - `button-secondary`
  - `badge-accent`
  - `badge-neutral`
  - `link-accent`
  - `text-link-danger`
  - `alert-danger`
  - `alert-success`
- Forms and identity:
  - `field`
  - `avatar-token`
- Media and maps:
  - `preview-frame`
  - `preview-image`
  - `preview-placeholder`
  - `map-shell`
  - `map-canvas`
  - `map-overlay`
  - `dropzone-active`

If a route needs a new visual pattern, add a reusable utility to
[`app/app.css`](../app/app.css) or a shared component in
[`app/components`](../app/components) instead of embedding a new raw color
combination directly in JSX.

## Typography

- Display headings use `var(--font-display)`.
- Body text uses `var(--font-body)`.
- `eyebrow` is the shared small uppercase label style for section labels.
- Page and section headings should keep the current hierarchy:
  - page title: `text-4xl`
  - section title: `text-2xl`
  - card title: `text-lg`
- Helper and metadata copy should use `--color-text-muted`.

## Spacing and Shape

- Primary radius scale:
  - major shells and panels: `rounded-3xl`
  - cards and grouped items: `rounded-2xl`
  - fields: `rounded-2xl` or `rounded-xl` through `field`
  - pills and badges: `rounded-full`
- Primary content spacing:
  - page sections: `space-y-8`
  - panel padding: `p-5` or `p-6`
  - larger hero or auth blocks: `p-8` or `p-10`
- Use existing spacing utilities consistently before introducing custom pixel
  values.

## Panels and Cards

- Use `panel` for top-level route containers and major sections.
- Use `surface-card` for repeated items inside a `panel`.
- Use `surface-card-subtle` for softer nested surfaces inside a stronger card.
- Use `surface-dashed` for empty, drop, and filter-miss states.
- Selected state should be expressed through semantic accent tokens, not raw
  hard-coded fills.

## Buttons and Links

- `button-primary` is reserved for the dominant action in a local context.
- `button-secondary` is the default for neutral actions.
- Destructive inline actions should use `text-link-danger`.
- Navigational inline links should use `link-accent`.
- Avoid more than one `button-primary` in the same tight action group unless
  the actions are truly equivalent.

## Forms

- Use `field` for text inputs, selects, and textareas.
- Labels stay visible above the field; placeholders are supplementary.
- Validation and mutation feedback should use `alert-danger` or
  `alert-success`.
- Form action rows should stack on small screens and align horizontally on
  larger ones.

## Accessibility Baseline

- Interactive elements must have an accessible name.
- Form fields must keep a visible label or an equivalent programmatic label.
- Use native controls (`button`, `input`, `select`, `textarea`, `a`) before
  introducing custom interactive wrappers.
- Keyboard focus must stay visible in both light and dark themes.
- Route-level accessibility smoke tests run through `jest-axe` for key screens.
- ESLint accessibility rules are enforced through `eslint-plugin-jsx-a11y`.

## Motion

- Keep transitions short and purposeful.
- Default interaction timing stays in the `160ms` range.
- Favor `transform`, `opacity`, `background-color`, and `box-shadow`.
- Avoid decorative animation on dense data screens.

## Responsive Contract

The frontend must remain usable at these viewport classes:

- Mobile: `360x800`
- Tablet: `768x1024`
- Laptop: `1280x800`
- Desktop: `1536x960`

For key routes (`/`, `/login`, `/app`, `/app/library`, `/app/spaces`,
`/app/settings`):

- no horizontal overflow
- primary navigation remains reachable
- primary actions remain visible and clickable
- cards and panels do not collapse into unreadable layouts
- detail screens remain usable with touch input

## Route-Level Rules

- Route modules should not introduce new raw `rgba(...)`, hex color literals,
  or arbitrary color class values when an existing semantic token or shared
  utility is available.
- Prefer shared `PageHeader`, `Panel`, `EmptyState`, and future primitives over
  route-local one-off shells.
- When a new route needs a special visual treatment, first decide whether it is:
  - a global token change
  - a reusable utility class
  - a new shared component

## Quality Gates

Every UI change should keep these checks green:

- `npm run format:check`
- `npm run lint`
- `npm run stylelint`
- `npm run guard:design`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e`
- `npm run build`

This guide is the baseline for `FE-DESIGN` work, admin UI, search UI, and
future theme switching.
