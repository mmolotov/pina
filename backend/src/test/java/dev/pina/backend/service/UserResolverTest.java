package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import dev.pina.backend.domain.PersonalLibrary;
import dev.pina.backend.domain.User;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

@QuarkusTest
class UserResolverTest {

	@Inject
	UserResolver userResolver;

	@Test
	void currentUserIsIdempotentAndCreatesSinglePersonalLibrary() {
		User first = userResolver.currentUser();
		User second = userResolver.currentUser();

		assertNotNull(first);
		assertNotNull(second);
		assertEquals(first.id, second.id);
		assertEquals(1L, User.count("email", "admin@pina.dev"));
		assertEquals(1L, PersonalLibrary.count("owner.id", first.id));
	}
}
