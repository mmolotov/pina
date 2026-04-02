package dev.pina.backend.api.dto;

import dev.pina.backend.domain.InviteLink;
import dev.pina.backend.domain.SpaceRole;

public record InviteLinkInfoDto(String spaceName, String spaceDescription, SpaceRole defaultRole) {

	public static InviteLinkInfoDto from(InviteLink link) {
		return new InviteLinkInfoDto(link.space.name, link.space.description, link.defaultRole);
	}
}
