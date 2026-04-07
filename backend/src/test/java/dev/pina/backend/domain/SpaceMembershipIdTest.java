package dev.pina.backend.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import io.quarkus.test.junit.QuarkusTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;

@QuarkusTest
class SpaceMembershipIdTest {

	@Test
	void equalsAndHashCodeCoverAllBranches() {
		UUID spaceId = UUID.randomUUID();
		UUID userId = UUID.randomUUID();

		SpaceMembership.SpaceMembershipId first = new SpaceMembership.SpaceMembershipId(spaceId, userId);
		SpaceMembership.SpaceMembershipId same = new SpaceMembership.SpaceMembershipId(spaceId, userId);
		SpaceMembership.SpaceMembershipId differentSpace = new SpaceMembership.SpaceMembershipId(UUID.randomUUID(),
				userId);
		SpaceMembership.SpaceMembershipId differentUser = new SpaceMembership.SpaceMembershipId(spaceId,
				UUID.randomUUID());

		// same reference
		assertEquals(first, first);
		// equal by value
		assertEquals(first, same);
		assertEquals(first.hashCode(), same.hashCode());
		// not equal: different space (short-circuits &&)
		assertNotEquals(first, differentSpace);
		// not equal: different user (second operand of &&)
		assertNotEquals(first, differentUser);
		// not equal: null (instanceof false branch)
		assertNotEquals(null, first);
		assertNotNull(first);
	}
}
