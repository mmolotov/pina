package dev.pina.backend.api.dto;

import dev.pina.backend.domain.InviteLink;
import dev.pina.backend.domain.SpaceRole;
import java.time.OffsetDateTime;
import java.util.UUID;

public record InviteLinkDto(UUID id, String code, SpaceRole defaultRole, OffsetDateTime expiration, Integer usageLimit,
		int usageCount, boolean active, UUID createdById, OffsetDateTime createdAt) {

	public static InviteLinkDto from(InviteLink link) {
		return new InviteLinkDto(link.id, link.code, link.defaultRole, link.expiration, link.usageLimit,
				link.usageCount, link.active, link.createdBy != null ? link.createdBy.id : null, link.createdAt);
	}
}
