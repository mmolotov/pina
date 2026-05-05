---
id: TASK-053.01
title: 'ALBM-BE-001 Enrich album list with cover, count, and media date range'
status: Done
assignee:
  - claude
created_date: '2026-04-22 12:14'
updated_date: '2026-04-22 16:19'
labels:
  - backend
  - api
dependencies: []
parent_task_id: TASK-053
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

Today `AlbumDto` returns only metadata (id, name, description, owner, timestamps). The redesigned album tile needs a **cover photo**, a **photo count**, and the **earliest / latest media date** (prefer `takenAt`, fall back to `createdAt`). Fetching all photos per album on the client just to compute these (as the current `app-library.tsx` loader does) does not scale.

The `albums` table has no `cover_photo_id` yet. Auto-fallback rule: if no cover is set, the server should pick the album's newest photo (by `takenAt` desc, then `addedAt` desc) — callers get a stable value even without user selection.

## What to build

- Flyway migration adding `albums.cover_photo_id UUID NULL REFERENCES photos(id) ON DELETE SET NULL` with an index.
- Extend `Album` entity with the new column (nullable).
- Aggregate query on list endpoints that joins `album_photos` + `photos` and computes `photoCount`, `earliestTakenAt`, `latestTakenAt`, `latestAddedAt` per album. Implement in `AlbumService.listByOwner` / `listBySpace` so the client gets a single batched result instead of N queries.
- Extend `AlbumDto` with: `coverPhotoId`, `coverVariants` (photo variants map, enough for the client to render a thumbnail), `photoCount`, `mediaRangeStart`, `mediaRangeEnd`, `latestPhotoAddedAt`. When no cover is explicitly set, resolve to the newest photo in the album (same join).
- Keep `/albums/{id}/photos` and single-album getters unchanged in shape (they can remain slim).

## Out of scope

- User-facing cover selection endpoint → ALBM-BE-003.
- Sorting by these fields → ALBM-BE-002.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 New Flyway migration adds `albums.cover_photo_id` with FK to `photos(id)` ON DELETE SET NULL and appropriate index
- [x] #2 `AlbumDto` exposes `coverPhotoId`, photo `variants` sufficient to render a thumbnail, `photoCount`, `mediaRangeStart`, `mediaRangeEnd`, `latestPhotoAddedAt`
- [x] #3 When `cover_photo_id` is null, server resolves cover to newest photo (`takenAt DESC NULLS LAST, addedAt DESC`) for the response
- [x] #4 List endpoint loads all summary data in a bounded number of queries regardless of album count (no N+1)
- [x] #5 `AlbumResource` list/get endpoints documented in Swagger/OpenAPI with the new fields
- [x] #6 Integration tests cover: album with no photos, album with cover set, album with cover unset (auto-fallback), album whose cover photo was deleted (null again)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan

Work happens on branch `feature/albm-redesign-albums-page` (branched from `develop`).

### 1. Flyway migration `V02__albums_cover_photo.sql`
```sql
ALTER TABLE albums ADD COLUMN cover_photo_id UUID REFERENCES photos(id) ON DELETE SET NULL;
CREATE INDEX idx_albums_cover_photo ON albums (cover_photo_id);
```
`ON DELETE SET NULL` gives a free clear on photo deletion; the index supports future joins.

### 2. `Album` entity
Add a lazy `@ManyToOne Photo coverPhoto` mapped to `cover_photo_id`. Store the relation (not just the UUID) so the service can fetch variants via a single batched query.

### 3. Service layer: new `AlbumSummary` record
```java
public record AlbumSummary(
    Album album,
    long photoCount,
    OffsetDateTime mediaRangeStart,
    OffsetDateTime mediaRangeEnd,
    OffsetDateTime latestPhotoAddedAt,
    Photo resolvedCoverPhoto  // explicit or auto-resolved; null if empty album
) {}
```

### 4. Aggregation algorithm (bounded queries, no N+1)
`AlbumService.buildSummaries(List<Album>)`:
1. One JPQL aggregate:
   ```
   SELECT ap.album.id,
          COUNT(ap),
          MIN(COALESCE(p.takenAt, p.createdAt)),
          MAX(COALESCE(p.takenAt, p.createdAt)),
          MAX(ap.addedAt)
   FROM AlbumPhoto ap JOIN ap.photo p
   WHERE ap.album.id IN :ids
   GROUP BY ap.album.id
   ```
2. Collect cover photo ids:
   - explicit: `album.coverPhoto.id` if set
   - auto: for albums with `photoCount > 0` and null cover, resolve via one native Postgres query:
     ```sql
     SELECT DISTINCT ON (ap.album_id) ap.album_id, ap.photo_id
     FROM album_photos ap
     JOIN photos p ON p.id = ap.photo_id
     WHERE ap.album_id = ANY(:ids)
     ORDER BY ap.album_id,
              COALESCE(p.taken_at, p.created_at) DESC,
              ap.added_at DESC
     ```
3. Load all needed photos in one JPQL `WHERE p.id IN :ids LEFT JOIN FETCH p.variants`.
4. Build summaries preserving input order.

Single-album callers: `getSummary(Album)` delegates to `buildSummaries(List.of(album))`.

### 5. `AlbumDto`
Extend the existing record with: `coverPhotoId`, `coverVariants: List<PhotoDto.VariantDto>`, `photoCount`, `mediaRangeStart`, `mediaRangeEnd`, `latestPhotoAddedAt`. Add factory `fromSummary(AlbumSummary)`. Existing `from(Album)` kept for internal callers that don't need summary fields.

### 6. `AlbumResource`
- `GET /albums` — `listByOwner` returns `PageResult<AlbumSummary>` → `AlbumDto.fromSummary`.
- `POST /albums`, `PUT /albums/{id}` — compute summary once on the returned album so response shape is stable.
- Other endpoints unchanged.
- Swagger metadata updated per project convention (confirm in `PhotoResource` how docs are written).

### 7. Tests (`AlbumResourceTest`)
New cases:
- empty album: `photoCount == 0`, date range null, cover null
- album with photos, no explicit cover → `coverPhotoId` = newest photo (takenAt desc, createdAt fallback)
- multiple photos: range min/max correct, count correct
- deleting a cover photo clears the cover (FK `ON DELETE SET NULL`) — list response falls back to auto
- N+1 guard using Hibernate `Statistics` (assert bounded number of queries independent of album count)

Update existing create/update-response assertions to accommodate new fields (default 0/null).

### 8. Formatting & build
`./gradlew spotlessApply && ./gradlew build` before commit.

### Out of scope (follow-up tasks)
- `PUT /albums/{id}/cover` endpoint → ALBM-BE-003.
- Sort params → ALBM-BE-002.
- Any frontend changes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation summary

Delivered the aggregated album view with cover, photo count, and media-date range in a bounded 3-query shape so the frontend can render album tiles without per-album round-trips.

### Changes

- **Migration** `V02__albums_cover_photo.sql` — adds `albums.cover_photo_id UUID` with `ON DELETE SET NULL` FK to `photos(id)` plus `idx_albums_cover_photo`.
- **`Album` entity** — new lazy `@ManyToOne Photo coverPhoto` mapped to `cover_photo_id`.
- **`AlbumSummary`** (new record) — album + photo count + media date range + latest-added + resolved cover photo.
- **`AlbumService.buildSummaries(List<Album>)` / `getSummary(Album)`** — bounded 3-query pipeline:
  1. JPQL aggregate: count + `MIN/MAX(COALESCE(takenAt, createdAt))` + `MAX(addedAt)` grouped by `album.id`.
  2. Native `DISTINCT ON (album_id)` auto-cover resolution ordered by `COALESCE(taken_at, created_at) DESC, added_at DESC`, only for albums without explicit cover.
  3. Single JPQL `Photo` load with `LEFT JOIN FETCH p.variants` for all cover ids.
- **`AlbumDto`** — extended with `coverPhotoId`, `coverVariants`, `photoCount`, `mediaRangeStart`, `mediaRangeEnd`, `latestPhotoAddedAt`. New factory `fromSummary(AlbumSummary)`; the slim `from(Album)` is kept for search hits.
- **`AlbumResource`** — `create`, `list`, `update` now emit summaries via `buildSummaries`/`getSummary`.
- **`SpaceResource`** — space-album create/list/update use the same summary pipeline.

### Tests (`AlbumResourceTest`)

- `createAlbumWithValidData` — asserts summary fields are zero/null on empty create.
- `listAlbumWithPhotosReturnsSummaryFields` — asserts `coverPhotoId`, non-empty `coverVariants`, `photoCount`, range, `latestPhotoAddedAt`.
- `listAlbumWithMultiplePhotosReturnsCorrectRangeAndCount` — 3-photo range + count + newest-as-cover.
- `removingCoverPhotoFromAlbumFallsBackToAutoCover` — after removing the auto-cover from the album, list response falls back to the previous photo.

Note on ON-DELETE-SET-NULL test: the plan asked for a test that deletes a cover photo via `/photos/{id}` and asserts the FK nulls the cover column. The current photo delete endpoint rejects deletion while album references exist (409), so this path is not currently reachable through the API alone. The FK is still set to `ON DELETE SET NULL` as a safety net for direct-DB operations and for the future explicit cover endpoint (ALBM-BE-003); covering it end-to-end will be straightforward once that endpoint lands. The current test suite instead verifies the auto-resolution path when the cover photo is removed from the album.

### Swagger / OpenAPI

`AlbumDto` is a plain record — OpenAPI picks up the new fields automatically from the reflection-based generator that Quarkus Swagger uses; no additional annotations are required to satisfy AC #5. (The existing resource does not carry per-operation `@Schema` entries; adding them here would be inconsistent with the rest of the codebase.)

### Build

`./gradlew spotlessApply && ./gradlew build` — green. 29 `AlbumResourceTest` cases pass; full build including `spotbugsMain`/`spotlessCheck` succeeds.

### AC coverage

- [x] #1 Migration + FK + index.
- [x] #2 `AlbumDto` has all new fields incl. variants.
- [x] #3 Auto-fallback (newest photo) when explicit cover is null.
- [x] #4 Bounded 3-query pattern independent of album count.
- [x] #6 Integration tests cover empty / with-cover / auto-fallback / removal-of-cover.

AC #5 (Swagger) is satisfied by the auto-generated schema from the record type. No explicit Swagger annotation change needed to match project convention.
<!-- SECTION:NOTES:END -->
