---
id: TASK-053.20
title: >-
  TASK-53-FE-REVIEW Stream album archive download instead of buffering the full
  blob
status: Done
assignee: []
created_date: '2026-04-24 05:30'
updated_date: '2026-04-24 07:31'
labels:
  - frontend
  - performance
  - memory
  - review
dependencies:
  - TASK-053.27
references:
  - frontend/app/lib/api.ts
  - frontend/app/routes/app-album-detail.tsx
  - frontend/app/routes/app-library.tsx
parent_task_id: TASK-053
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`downloadAlbumArchive` calls `await response.blob()` on the ZIP stream, which forces the browser to buffer the entire archive in memory before the save dialog opens. For albums with many high-resolution originals this easily exceeds 1-2 GB and can OOM the tab. The authenticated `/albums/{id}/download` endpoint is a streaming response and should reach disk without a full in-memory copy.

Acceptance Criteria:
- Initiating an album download does not require buffering the full archive in memory on the client.
- The chosen flow still carries the authenticated session (Authorization header or equivalent) so the endpoint stays behind auth.
- The filename chosen by the server is preserved on the saved file.
- Download behavior is covered by an integration or route test that does not regress to a `response.blob()` code path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Initiating an album download does not require buffering the full archive in memory on the client.
- [x] #2 The chosen flow still carries the authenticated session when minting the short-lived download URL, so archive access stays gated behind auth.
- [x] #3 The filename chosen by the server is preserved by letting the browser follow the signed URL directly.
- [x] #4 Download behavior is covered by frontend tests that do not regress to a `response.blob()` code path.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect the current frontend album download flow in `app-library`, `app-album-detail`, and `app/lib/api.ts` to locate every `response.blob()` call and the current filename handling.
2. Replace the fetch-and-buffer approach with a signed download URL flow that opens a browser-native download path without holding the ZIP in JS memory.
3. Preserve existing UX states and errors in album actions while wiring the new API endpoint and server-provided filename handling.
4. Add frontend test coverage that asserts the new flow uses the signed URL path rather than `response.blob()`.
5. Run frontend typecheck and targeted route/API tests, then finalize the task in Backlog.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Replaced the old `downloadAlbumArchive` blob-based helper with `createAlbumArchiveDownloadUrl`, which authenticates only the mint request and returns a signed same-origin download URL. `app-library` and `app-album-detail` now trigger browser-native downloads through an anchor click on that URL, avoiding `response.blob()` and object-URL buffering for album ZIPs. Added API and route tests to cover the new flow and explicitly assert that the album download helper does not read `response.blob()`.

Validated with `npm run typecheck` and `npm run test -- --run app/lib/api.test.ts app/routes/app-library.test.tsx app/routes/app-album-detail.test.tsx`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Switched album archive downloads to a signed URL flow so the browser can stream ZIP responses directly to disk without buffering the full archive in JS memory. The authenticated mint step remains in place, server-selected filenames are preserved, and frontend tests cover the new non-blob path.
<!-- SECTION:FINAL_SUMMARY:END -->
