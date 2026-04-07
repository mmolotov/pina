package dev.pina.backend.api.dto;

import static org.junit.jupiter.api.Assertions.assertNull;

import dev.pina.backend.domain.InviteLink;
import dev.pina.backend.domain.SpaceRole;
import io.quarkus.test.junit.QuarkusTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;

@QuarkusTest
class InviteLinkDtoTest {

	@Test
	void fromLinkWithNullCreatedByReturnsNullCreatedById() {
		InviteLink link = new InviteLink();
		link.id = UUID.randomUUID();
		link.code = "test-code";
		link.defaultRole = SpaceRole.MEMBER;
		link.createdBy = null;

		InviteLinkDto dto = InviteLinkDto.from(link);

		assertNull(dto.createdById());
	}
}
