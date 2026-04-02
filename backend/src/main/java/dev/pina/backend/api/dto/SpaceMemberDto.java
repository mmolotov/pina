package dev.pina.backend.api.dto;

import dev.pina.backend.domain.SpaceMembership;
import dev.pina.backend.domain.SpaceRole;
import java.time.OffsetDateTime;
import java.util.UUID;

public record SpaceMemberDto(UUID userId, String userName, String userAvatarUrl, SpaceRole role,
		OffsetDateTime joinedAt) {

	public static SpaceMemberDto from(SpaceMembership m) {
		return new SpaceMemberDto(m.user.id, m.user.name, m.user.avatarUrl, m.role, m.joinedAt);
	}
}
