package dev.pina.backend.api.dto;

import dev.pina.backend.domain.SpaceVisibility;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminSpaceDto(UUID id, String name, String description, SpaceVisibility visibility, UUID parentId,
		int depth, UUID creatorId, String creatorName, int memberCount, long albumCount, long photoCount,
		OffsetDateTime createdAt, OffsetDateTime updatedAt) {
}
