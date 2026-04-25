---
id: TASK-055.04
title: ALBM2-BE-001 Expose album preview photos in AlbumDto
status: To Do
assignee: []
created_date: '2026-04-25 13:39'
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
- [ ] #1 AlbumDto exposes previewPhotos: array of {id, takenAt, variants} (max 4 per album)
- [ ] #2 listAlbums and getAlbum populate the field via a single optimised query (no N+1)
- [ ] #3 Existing AlbumDto fields are unchanged; clients that ignore the new field keep working
- [ ] #4 Backend tests cover ordering, empty albums, and access control matching listAlbumPhotos
<!-- AC:END -->
