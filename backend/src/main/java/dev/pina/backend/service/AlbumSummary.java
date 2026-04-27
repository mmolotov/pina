package dev.pina.backend.service;

import dev.pina.backend.domain.Album;
import dev.pina.backend.domain.Photo;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Aggregated view of an album enriched with photo-count and media-date
 * statistics, the photo that should be used as the cover, and a bounded list of
 * preview photos for the album-tile mosaic. The cover is either the one
 * explicitly chosen by the user or auto-resolved to the newest photo in the
 * album; it is {@code null} for empty albums. Preview photos are ordered by
 * {@code COALESCE(takenAt, createdAt)} descending and capped at
 * {@link AlbumService#MAX_PREVIEW_PHOTOS}.
 */
public record AlbumSummary(Album album, long photoCount, OffsetDateTime mediaRangeStart, OffsetDateTime mediaRangeEnd,
		OffsetDateTime latestPhotoAddedAt, Photo resolvedCoverPhoto, List<Photo> previewPhotos) {

	public static AlbumSummary empty(Album album) {
		return new AlbumSummary(album, 0L, null, null, null, null, List.of());
	}
}
