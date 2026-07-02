---
id: TASK-061
title: 'ADMIN-A Admin redesign: shell + shared components + restyle 6 sections'
status: In Progress
assignee: []
created_date: '2026-07-02 07:19'
labels:
  - frontend
  - admin
  - redesign
  - FE-DESIGN
dependencies: []
references:
  - >-
    claude_design project pina 37e87e11-df98-438d-a62a-e5a92689de75:
    pina-admin.jsx, pina-admin-sections.jsx, pina-admin-shared.jsx,
    pina-admin.css
  - TASK-059 / TASK-060 (same porting pattern)
  - 'Follow-ups: ADMIN-B (Overview aggregate), ADMIN-C (ML + AdminMlResource)'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Part A of the claude.ai/design "pina" Admin-area port (same pattern as TASK-059/060). Frontend-only, lowest risk — the data layer is unchanged. Re-skins the admin shell + the 6 already-working sections; introduces the shared admin UI component system + helpers + the missing `warn` token. Overview (ADMIN-B) and ML/Анализ (ADMIN-C) are follow-up tasks/PRs.

Design source (claude_design MCP, project pina 37e87e11-df98-438d-a62a-e5a92689de75): pina-admin.jsx, pina-admin-sections.jsx, pina-admin-shared.jsx, pina-admin.css. Russian-only copy — add the English catalog.

Keep nested per-section routes (deep-linkable; preserves loader/action + tests). Re-skin app-admin-layout.tsx into the adm shell (header + left nav w/ per-section count badges + scope card + toast + styled denied/loading gate). Restyle Users/Spaces/Invites/Storage/Health/Settings bodies to the prototype, keeping their existing /api/v1/admin/* wiring.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Admin shell matches the prototype: header (eyebrow/title/lede + Open library + section badge), left nav panel with per-section count badges + instance-admin scope card, toast; nested routes preserved; styled denied + loading gate states
- [ ] #2 Shared admin UI ported to components/admin/ui.tsx (ABadge tones incl. warn +dot, ABar danger>85, APager, AConfirm alertdialog reusing DialogShell focus-trap + .button-danger, ASkeletonRows, AEmpty, ATableError) + lib/admin-format.ts (locale-aware Intl fmtBytes/fmtNum/fmtDate + 3-form plural helper); adm-* CSS ported; --color-warn[-soft|-strong] token added
- [ ] #3 All 6 existing sections restyled to the prototype and still wired to the existing /admin/* API: Users (role/status confirm + self-guard, search, pager), Spaces (depth tree, delete w/ cascade warning), Invites (copy, usage bar, revoke), Storage (KPI + FS fill bar + >85% warning + user/space tabs), Health (DB/Storage/JVM cards + refresh), Settings (registration/compression/quality/max-res validation + dirty footer)
- [ ] #4 i18n ru/en complete for shell + shared components + all 6 sections incl. Russian 3-form plurals and locale-aware Intl number/date; a11y (aria-current, focus-trap, aria-pressed); light/dark + responsive
- [ ] #5 Gates green: frontend npm run check / test / test:e2e / build (existing admin route tests updated for new markup; e2e fixtures updated)
<!-- AC:END -->
