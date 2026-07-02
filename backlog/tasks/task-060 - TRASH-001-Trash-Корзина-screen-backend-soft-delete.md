---
id: TASK-060
title: TRASH-001 Trash (Корзина) screen + backend soft-delete
status: Done
assignee: []
created_date: '2026-07-01 11:53'
updated_date: '2026-07-02 05:30'
labels:
  - frontend
  - backend
  - trash
  - soft-delete
  - redesign
  - FE-DESIGN
dependencies: []
references:
  - >-
    claude_design project pina 37e87e11-df98-438d-a62a-e5a92689de75:
    pina-trash.jsx, pina-trash.css
  - TASK-059 (Spaces redesign — same porting pattern)
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Port the claude.ai/design "pina" Trash (Корзина) screen into the real app and add the backend soft-delete capability it requires (same porting pattern as the Photos/Map/Spaces redesigns — see TASK-059). Keeps the existing data layer (clientLoader/clientAction + app/lib/api.ts), i18n (ru/en), and design-system CSS in app/app.css.

Retention model: soft-delete, retained 30 days (config-driven pina.trash.retention-days), then auto-purged. Soft-delete must NOT touch storage; only purge deletes variants. Trashed rows are hidden from every normal read via @SQLRestriction("deleted_at is null") on Photo and Album; trash read/restore/purge use native SQL to see trashed rows.

v1 scope: personal photos + personal albums (owner-scoped). The deleted_at column is added to albums too; space listings just exclude trashed rows defensively.

Design source (read via claude_design MCP, project "pina" 37e87e11-df98-438d-a62a-e5a92689de75): pina-trash.jsx / pina-trash.css (interaction + visual contract; Russian-only — add the English catalog). Reference render: screenshots/trash.png, screenshots/trash-select.png.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 V04 migration adds deleted_at (timestamptz NULL) to photos+albums with partial indexes; Photo+Album entities carry deletedAt and hide trashed rows from every normal listing (library photos, albums, album-photos + counts/cover, search, geo/map, favorites) — proven by backend tests
- [x] #2 DELETE /photos/{id} and DELETE /albums/{id} are soft-deletes: no row/storage removal, no 409 for album-referenced photos; storage untouched until purge
- [x] #3 GET /trash returns owner-scoped photos+albums with correct daysLeft/purgeAt/photoCount + summary; kind filter (all|photo|album) and sort (deleted|soon|name) work
- [x] #4 Restore, purge (single/bulk) and empty-trash work end-to-end; purge removes rows+storage+favorites; restore fully reinstates (incl. album membership)
- [x] #5 TrashPurgeJob auto-purges items past the config-driven retention (default 30d), modeled on BrowserSessionCleanupJob
- [x] #6 /app/trash matches pina-trash.jsx: header, info strip, controls, photo/album tiles (danger <=3d, album {n} фото), hover Restore/Delete-forever, select mode + floating bulk bar, toast+undo, alertdialog confirm, empty/loading/error
- [x] #7 i18n ru/en complete incl. Russian 3-form plurals; light/dark + responsive; focus-trap/a11y (aria-pressed, role=tab/alertdialog)
- [x] #8 Gates green: frontend npm run check / test / test:e2e / build and backend ./gradlew spotlessApply build
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Ported the Trash (Корзина) screen from the claude.ai/design "pina" prototype and added the backend soft-delete it requires (same pattern as TASK-059). Branch: feature/trash-screen.

BACKEND (net-new soft-delete):
- V04__soft_delete_trash.sql: deleted_at (+ unused-in-v1 deleted_by) on photos/albums + partial indexes.
- Photo/Album carry OffsetDateTime deletedAt + class-level @SQLRestriction("deleted_at is null") — trashed rows vanish from every HQL/Panache/em.find read (direct GET /photos|albums/{id} → 404).
- DELETE /photos|albums/{id} are now soft-deletes (204; removed the 409 HAS_REFERENCES check so album-referenced photos can be trashed; storage untouched). The old hard-delete logic is reused as PhotoService.purge / AlbumService.purge (native DELETE, DB cascades variants/ml/album_photos; favorites removed explicitly since they have no FK; stored variants deleted afterCommit).
- TrashService + /api/v1/trash (owner-scoped, native SQL to see trashed rows): GET ?kind&sort -> {items, summary}; POST /restore; POST /purge; DELETE (empty). TrashPurgeJob (@Scheduled, concurrentExecution=SKIP) + typed TrashConfig (pina.trash.retention-days=30, pina.trash.purge.interval).
- Trashed rows excluded everywhere (library list+count, geo/map, search, favorites, album photo listings + AlbumSummary count/cover, AlbumService.listByOwner/listBySpace, AdminSpaceService counts). Fixed a subtle Hibernate HQL join-elision trap: `COUNT(ap) FROM AlbumPhoto ap JOIN ap.photo p` drops the inner join when no p-column is referenced, so the restriction is skipped — added explicit `p.deletedAt IS NULL` to count/existence queries; native cover/preview/geo queries got explicit `deleted_at IS NULL`.
- Tests: new TrashResourceTest + TrashServiceTest; updated PhotoResourceTest/PhotoServiceTest/AlbumResourceTest and MlAnalysisServiceTest (delete = soft/keeps ML rows; purge cascades ML rows). ./gradlew build + spotbugsMain green on a clean DB (476 tests, 0 failed).

FRONTEND (Trash screen port):
- app/routes/app-trash.tsx: clientLoader (getTrash), clientAction (restore/purge/empty/retrash via useFetcher), TrashScreen with client-side kind filter + sort, optimistic animated removal (~230ms) + loader revalidation, toast+undo, focus-trapped alertdialog ConfirmPurge. components/trash-tile.tsx (photo fill / album 2×2 mosaic, danger countdown ≤3d, {n} фото kind badge, hover Restore/Delete-forever, select mode). api.ts getTrash/restoreTrash/purgeTrash/emptyTrash + types/api.ts Trash* DTOs.
- app.css: ported tr-* families + .button-danger (tile palette via [data-tr-hue] so component code has no color literals — guard:design). i18n: full app.trash.* ru+en incl. Russian 3-form plurals via the existing formatRelativeCount; removed the app.collection.trash.* placeholder + its test.
- Tests: app-trash.test.tsx (data/empty/error states, filter, sort, select+bulk, restore+undo, purge+confirm, empty-trash, danger badge, ru). e2e fixtures add /trash. npm run check / test (168) / test:e2e (9) / build all green.

Deliberate deviation: no per-route loading skeleton — SPA mode forbids HydrateFallback on non-root routes, and with an awaited clientLoader + optimistic revalidation a Suspense/Await skeleton would flash on every mutation. The .tr-skel CSS is retained from the port.

Note: not committed yet (awaiting the user's go-ahead). Local full-suite runs against a long-lived shared dev DB (pina-dev-pg) fail the fixed-username Auth* tests with 409 collisions; verified green against a fresh throwaway DB — CI uses a fresh container.
<!-- SECTION:FINAL_SUMMARY:END -->
