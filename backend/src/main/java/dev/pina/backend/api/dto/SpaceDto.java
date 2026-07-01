package dev.pina.backend.api.dto;

import dev.pina.backend.domain.Space;
import dev.pina.backend.domain.SpaceRole;
import dev.pina.backend.domain.SpaceVisibility;
import java.time.OffsetDateTime;
import java.util.UUID;

public record SpaceDto(UUID id, String name, String description, String avatarUrl, SpaceVisibility visibility,
		UUID parentId, int depth, boolean inheritMembers, UUID creatorId, SpaceRole myRole, long memberCount,
		long albumCount, OffsetDateTime createdAt, OffsetDateTime updatedAt) {

	public static SpaceDto from(Space s) {
		return from(s, null, 0L, 0L);
	}

	public static SpaceDto from(Space s, SpaceRole myRole, long memberCount, long albumCount) {
		return new SpaceDto(s.id, s.name, s.description, s.avatarUrl, s.visibility,
				s.parent != null ? s.parent.id : null, s.depth, s.inheritMembers, s.creator.id, myRole, memberCount,
				albumCount, s.createdAt, s.updatedAt);
	}
}
