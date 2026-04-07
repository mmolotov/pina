# UI/UX Implementation Plan

Implementation plan for the next frontend quality pass in Phase 3. The goal is
to move PINA from a functional SPA to a governed UI system with explicit design
tokens, shared primitives, responsive contracts, accessibility checks, and
visual regression coverage.

## Goals

- Establish a reusable design foundation instead of route-local styling drift
- Define a semantic token system that supports both light and dark themes
- Document a practical style guide engineers can follow without design guesswork
- Add automated checks for accessibility, responsiveness, and visual regressions
- Enforce UI consistency through shared primitives and CI quality gates

## Scope

Current focus:

- light and dark themes with explicit theme switching
- frontend SPA routes already implemented in Phase 3
- route-level responsive behavior
- shared component and styling governance
- automated UI quality checks in CI

Current implementation status:

- semantic token foundation is implemented for light and dark themes
- theme switching with persisted preference is implemented
- design system documentation is in place
- shared UI primitives are adopted across the main Phase 3 routes
- accessibility linting and route-level smoke checks are implemented
- Playwright responsive and visual regression coverage is implemented for `/login`, `/app`, and `/app/library`
- CI now treats design conformance, accessibility, and browser-level route smoke as blocking checks

Explicitly out of scope for this pass:

- Storybook adoption unless the component surface grows substantially
- admin UI design specifics beyond reusable system-level patterns
- ML-specific search interaction design

## Design Principles

- Semantic tokens over raw colors in route modules
- Shared primitives before route-local ad hoc controls
- Route-first responsive testing instead of component-only screenshots
- Accessibility as a quality gate, not a later audit
- Minimal process overhead: only checks that provide stable engineering value

## Workstreams

### 1. Semantic Theme Foundation

- Split brand palette and semantic UI tokens
- Keep logo-derived brand colors in one place
- Map surfaces, text, borders, accents, feedback colors, and focus states through semantic tokens
- Implement semantic token layers for both light and dark themes
- Support explicit user theme switching instead of relying only on system preference

### 2. Theme Switching and Persistence

- Add an explicit theme switcher in the app shell
- Persist user theme preference on the client
- Support `light`, `dark`, and optionally `system` if the UX remains simple
- Ensure both themes use the same semantic token model

### 3. Design System and Style Guide

- Create a frontend design system document
- Define typography, spacing, radii, shadows, motion, panel rules, button variants, form rules, and empty/error state patterns
- Define allowed breakpoints and route expectations for each viewport class

### 4. Shared UI Primitives

- Extract and normalize reusable primitives:
  - Button
  - Field / Input
  - Panel / Card
  - PageHeader
  - SectionHeader
  - EmptyState
  - StatusBadge
  - FilterBar
- Reduce duplicated JSX class patterns in route modules

### 5. Accessibility Baseline

- Add static accessibility linting
- Add automated accessibility checks for key routes
- Define minimum accessibility expectations:
  - keyboard reachable navigation
  - visible focus states
  - accessible form labels
  - heading hierarchy
  - landmark usage
  - contrast compliance for both supported themes

### 6. Responsive and Visual Regression Automation

- Add route-level E2E smoke tests with responsive viewports
- Add screenshot regression tests for key routes
- Validate mobile and desktop layout integrity
- Validate no horizontal overflow on supported route states

Recommended baseline viewports:

- 360x800
- 768x1024
- 1280x800

Recommended initial route coverage:

- `/`
- `/login`
- `/app`
- `/app/library`
- `/app/library?view=timeline`
- `/app/library?view=map`
- `/app/spaces`
- `/app/settings`

Current implemented Playwright route coverage:

- `/login`
- `/app`
- `/app/library`

### 7. Style Guide Conformance and CI

- Add checks that prevent raw color drift outside the theme layer
- Keep Prettier, ESLint, and Stylelint as baseline gates
- Add UI-specific checks to CI:
  - accessibility smoke
  - responsive smoke
  - visual snapshots

## Suggested Delivery Order

1. Semantic theme foundation
2. Theme switching and persistence
3. Design system and style guide document
4. Shared primitives and route adoption
5. Accessibility linting and smoke checks
6. Responsive and visual regression automation
7. CI enforcement and style guide conformance guards

## Definition of Done

This workstream is complete when:

- the frontend uses a documented semantic design token system for both supported themes
- users can switch between light and dark themes without route-local styling breakage
- the style guide exists and is referenced by engineers
- shared primitives replace the most obvious duplicated route-local UI patterns
- key routes have automated accessibility and responsive coverage
- visual regressions are checked automatically for the selected critical routes
- CI blocks merges when UI quality gates fail
