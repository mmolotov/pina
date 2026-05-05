---
id: TASK-055.04
title: ALBM2-BE-001 Expose album preview photos in AlbumDto
status: Done
assignee: []
created_date: '2026-04-25 13:39'
updated_date: '2026-04-27 07:39'
labels:
  - backend
  - albums
  - performance
dependencies: []
parent_task_id: TASK-055
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The redesigned compact album tile renders a 4-photo mosaic in its bottom-right corner. The frontend currently fetches `listAlbumPhotos(albumId, 0, 4)` per tile — this is N+1 (one extra request per album on the list view). Need a backend-side optimisation.

**Proposal:** extend `AlbumDto` with `previewPhotos: PhotoVariantBundle[]` (top N=4 photos by `takenAt`/`createdAt`, returning each photo's id, original filename, takenAt and the same `variants` shape used for cover). Populate this in `AlbumService.toDto` for both `listAlbums` and `getAlbum`.

**Why N=4:** matches the prototype mosaic. Server-side `LIMIT 4` per album joined into one query plan is much cheaper than N+1 client calls.

**Frontend follow-up after BE ships:** drop the `useAlbumPreviewThumbs` hook in `app/components/album-tile.tsx` and use `album.previewPhotos` directly with `selectPhotoPreviewVariant`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 AlbumDto exposes previewPhotos: array of {id, takenAt, variants} (max 4 per album)
- [x] #2 listAlbums and getAlbum populate the field via a single optimised query (no N+1)
- [x] #3 Existing AlbumDto fields are unchanged; clients that ignore the new field keep working
- [x] #4 Backend tests cover ordering, empty albums, and access control matching listAlbumPhotos
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Extended `AlbumDto` with `previewPhotos: List<PreviewPhotoDto>` (each `{id, takenAt, variants}`), capped at `AlbumService.MAX_PREVIEW_PHOTOS = 4`, ordered by `COALESCE(takenAt, createdAt) DESC, addedAt DESC, photoId`.

**Backend**
- New nested `AlbumDto.PreviewPhotoDto` for the wire payload (no extra DTO file — keeps the cluster cohesive).
- `AlbumSummary` gains `previewPhotos: List<Photo>`; `empty()` returns an empty list.
- `AlbumService.buildSummaries` now adds one extra native query using `ROW_NUMBER() OVER (PARTITION BY ap.album_id ORDER BY …)` to pick the top-4 photos per non-empty album. Their IDs are merged into the existing photo-load JPQL (cover + previews fetched in a single round trip), so the per-batch query budget grows from 3 to 4 regardless of N. No N+1.
- Tests:
  - Unit (`AlbumServiceTest`): empty-album empty list, top-4 cap with deterministic `takenAt`, multi-album isolation.
  - API (`AlbumResourceTest`): wire-shape on a single-photo album, top-4 cap with order, empty album → empty array.

**Frontend**
- `AlbumDto` type extended with `previewPhotos: AlbumPreviewPhotoDto[]`.
- `useAlbumPreviewThumbs` rewritten to consume `album.previewPhotos` (no extra fetch); only `getPhotoBlob` per preview at `selectPhotoPreviewVariant` against a 96px target.
- `listAlbumPhotos` import dropped from album-tile.
- All AlbumDto test fixtures (`app-library`, `app-album-detail`, `app-album-photo-detail`, `app-search`) now include `previewPhotos: []`.

**Verification:** `./gradlew build` (incl. spotbugs + spotless + tests) green; `npm run build` + `npm test` (138 tests) green.

`PublicAlbumDto` deliberately left unchanged — public share viewers don't render the mosaic and shouldn't expose extra photo metadata to anonymous viewers.
<!-- SECTION:FINAL_SUMMARY:END -->
