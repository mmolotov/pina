package dev.pina.backend.api.dto;

import dev.pina.backend.domain.InviteLink;
import dev.pina.backend.domain.SpaceRole;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminInviteLinkDto(UUID id, String code, UUID spaceId, String spaceName, SpaceRole defaultRole,
		OffsetDateTime expiration, Integer usageLimit, int usageCount, boolean active, UUID createdById,
		String createdByName, OffsetDateTime createdAt) {

	public static AdminInviteLinkDto from(InviteLink link) {
		return new AdminInviteLinkDto(link.id, link.code, link.space.id, link.space.name, link.defaultRole,
				link.expiration, link.usageLimit, link.usageCount, link.active, link.createdBy.id, link.createdBy.name,
				link.createdAt);
	}
}
