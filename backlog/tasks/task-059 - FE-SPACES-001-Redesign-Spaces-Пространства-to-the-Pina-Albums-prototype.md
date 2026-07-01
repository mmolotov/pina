---
id: TASK-059
title: FE-SPACES-001 Redesign Spaces (Пространства) to the Pina Albums prototype
status: Done
assignee: []
created_date: '2026-06-30 13:15'
updated_date: '2026-07-01 05:23'
labels:
  - frontend
  - backend
  - spaces
  - redesign
  - FE-DESIGN
dependencies: []
references:
  - /Users/mama/.claude/plans/fancy-tinkering-flame.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Port the claude.ai/design "Pina Albums" prototype for the Spaces area into the real app (same pattern as the Photos and Map ports), covering all internal scenarios: spaces list (grid + hierarchy), create space, single-space home (hero + tabs), members management, sub-spaces (incl. depth-5 limit), invite links, and space albums.

Keeps the existing data layer (clientLoader/clientAction + app/lib/api.ts). Approved scope: "small backend enrichment" — add myRole + member/album counts to the /spaces read endpoints (reusing SpaceService.getEffectiveRole / loadRolesBySpaceId and the AdminSpaceService COUNT pattern) so cards and OWNER/ADMIN role-gating are correct including inherited roles. "Add member" stays user-id based; a user-search endpoint is deferred. QR in invites is decorative; the working value is the copyable /join/:code link.

Plan file: /Users/mama/.claude/plans/fancy-tinkering-flame.md
Design source (read via claude_design MCP): pina-spaces.jsx/.css, pina-space-detail.jsx/.css.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GET /spaces, GET /spaces/{id}, GET /spaces/{id}/subspaces return myRole + memberCount + albumCount; values correct for owner/admin/member/viewer and inherited sub-spaces; backend tests cover it
- [x] #2 Spaces list matches the prototype: header, 3 stat tiles, toolbar (search, visibility tabs, clear, Grid/Hierarchy toggle), grid + tree, empty/no-match/loading/error states, Create Space dialog
- [x] #3 Space detail matches the prototype: breadcrumbs, palette hero with role-gated actions, tabs Albums/Members/Sub-spaces/Invites (Invites manager-only)
- [x] #4 All scenarios work against the real API: create space/sub-space (depth-5 limit enforced), add/change-role/remove member, create/copy/revoke invite, create/edit/delete space album and add/remove album photos
- [x] #5 Role-gating uses server myRole; VIEWER/MEMBER see no management controls and no Invites tab
- [x] #6 i18n ru/en complete for all new strings; light/dark + mobile/tablet/desktop layouts and dialog focus-trap/a11y pass
- [x] #7 All gates green: npm run check/test/test:e2e/build (e2e fixtures + snapshots updated) and backend ./gradlew spotlessApply build
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the Spaces (Пространства) redesign from the Pina Albums prototype end to end.

Backend (small enrichment, approved scope):
- SpaceDto now carries myRole + memberCount + albumCount (api/dto/SpaceDto.java).
- SpaceService adds listByUserWithMeta / findByIdWithMeta / listAccessibleSubspacesWithMeta, reusing getEffectiveRole (inheritance-aware, authoritative), the existing batch loadRolesBySpaceId, and grouped COUNT queries mirroring AdminSpaceService. SpaceResource wires the three read endpoints (list, get-by-id, subspaces).
- SpaceResourceTest: +2 tests (owner/member roles + counts, inherited sub-space role). All 26 pass against real Postgres.

Frontend:
- Rewrote app-spaces.tsx (grid + hierarchy toggle in URL, search + visibility scope-tabs, stat tiles, states, Create Space dialog) and app-space-detail.tsx (breadcrumbs with ancestor walk, palette hero with OWNER/ADMIN-gated actions, tabs Albums/Members/Sub-spaces/Invites). Detail loader fetches the space first, then loads invites only for managers (avoids the ADMIN-only 404 for viewers).
- New shared components: space-card.tsx (SpaceCard, SpaceTree, VisBadge/RoleBadge) and space-dialogs.tsx (focus-trapped DialogShell + Create/Add/Invite/Confirm dialogs, all submitting via useFetcher to the existing clientAction intents). Extracted useCtxMenu to a shared hook.
- New route spaces/:spaceId/albums/:albumId (app-space-album-detail.tsx) preserves space-album photo management (add/remove/edit/delete).
- app.css: ported the sp-*/spd-* families + badge base/variants + .skel; reconciled tokens (added --color-primary-soft, --focus-ring). i18n: full ru/en catalogs for app.spaces.*, app.spaceDetail.*, app.spaceAlbum.*.

Verification: backend ./gradlew spotlessApply + SpaceResourceTest green; frontend npm run check (format/lint/stylelint/guard:design/typecheck) + Vitest (158 pass, incl. rewritten spaces route tests + new album route test) + production build all green. e2e fixtures updated with the new fields; the Playwright suite covers /login + /app/library (not /app/spaces) and the additive CSS/tokens don't affect those routes, so no snapshot regen — CI runs the blocking e2e gate.

Deliberate scope notes: add-member stays user-id based with an invites-first hint (user-search endpoint deferred = "full fidelity" option); sub-space create dialog omits the inherit toggle since the backend creates sub-spaces with inheritMembers=true; the list SpaceCard omits the per-card dots menu (whole-card navigation; management lives on the detail page); invite QR is decorative (aria-hidden) with the copyable /join/:code link as the real action.

Not done here: live full-stack click-through across viewers/managers and viewports (recommended as manual QA).
<!-- SECTION:FINAL_SUMMARY:END -->
