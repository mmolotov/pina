package dev.pina.backend.api.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One row of the analysis queue, joined to the source photo's filename for
 * display.
 */
public record AdminMlJobDto(UUID photoId, String photoName, String status, int attempts, OffsetDateTime nextAttemptAt,
		String lastError, OffsetDateTime createdAt) {
}
