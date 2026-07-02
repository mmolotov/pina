package dev.pina.backend.api.dto;

/**
 * Aggregate over the whole trash, independent of any kind filter.
 *
 * @param totalItems
 *            number of trashed items (photos + albums)
 * @param totalBytes
 *            storage occupied by all trashed photos
 * @param soonestPurgeDays
 *            days until the nearest permanent purge (0 when empty)
 */
public record TrashSummaryDto(int totalItems, long totalBytes, int soonestPurgeDays) {
}
