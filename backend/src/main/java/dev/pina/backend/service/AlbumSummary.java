package dev.pina.backend.service;

import dev.pina.backend.domain.Album;
import dev.pina.backend.domain.Photo;
import java.time.OffsetDateTime;

/**
 * Aggregated view of an album enriched with photo-count and media-date
 * statistics plus the photo that should be used as the cover. The cover is
 * either the one explicitly chosen by the user or auto-resolved to the newest
 * photo in the album; it is {@code null} for empty albums.
 */
public record AlbumSummary(Album album, long photoCount, OffsetDateTime mediaRangeStart, OffsetDateTime mediaRangeEnd,
		OffsetDateTime latestPhotoAddedAt, Photo resolvedCoverPhoto) {

	public static AlbumSummary empty(Album album) {
		return new AlbumSummary(album, 0L, null, null, null, null);
	}
}
