package dev.pina.backend.api.dto;

/**
 * Top-level payload for {@code GET /admin/ml}: the ML service status plus the
 * analysis-queue rollup.
 */
public record AdminMlDto(AdminMlStatusDto status, QueueCounts counts) {

	public record QueueCounts(long pending, long completed, long failed) {
	}
}
