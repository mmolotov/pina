package dev.pina.backend.api.dto;

import java.util.List;

/**
 * The {@code GET /api/v1/trash} response: the (filtered, sorted) items plus a
 * whole-trash summary.
 */
public record TrashListDto(List<TrashItemDto> items, TrashSummaryDto summary) {
}
