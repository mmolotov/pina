package dev.pina.backend.api.dto;

import dev.pina.backend.domain.Space;
import dev.pina.backend.domain.SpaceVisibility;
import java.time.OffsetDateTime;
import java.util.UUID;

public record SpaceDto(UUID id, String name, String description, String avatarUrl, SpaceVisibility visibility,
		UUID parentId, int depth, boolean inheritMembers, UUID creatorId, OffsetDateTime createdAt,
		OffsetDateTime updatedAt) {

	public static SpaceDto from(Space s) {
		return new SpaceDto(s.id, s.name, s.description, s.avatarUrl, s.visibility,
				s.parent != null ? s.parent.id : null, s.depth, s.inheritMembers, s.creator.id, s.createdAt,
				s.updatedAt);
	}
}
