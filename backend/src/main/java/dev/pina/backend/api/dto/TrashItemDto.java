package dev.pina.backend.api.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One trashed item — a photo or a personal album — in the "Корзина" listing.
 *
 * @param kind
 *            {@code "PHOTO"} or {@code "ALBUM"}
 * @param name
 *            the photo's original filename or the album's name
 * @param sizeBytes
 *            storage occupied: for a photo, the sum of its variant sizes;
 *            always {@code 0} for an album (an album holds references, not
 *            media)
 * @param purgeAt
 *            {@code deletedAt + retention}: when the item is permanently
 *            removed
 * @param daysLeft
 *            whole days until {@code purgeAt}, floored at 0
 * @param photoCount
 *            live (non-trashed) member count for an album; {@code null} for a
 *            photo
 */
public record TrashItemDto(String kind, UUID id, String name, long sizeBytes, OffsetDateTime deletedAt,
		OffsetDateTime purgeAt, int daysLeft, Integer photoCount) {
}
