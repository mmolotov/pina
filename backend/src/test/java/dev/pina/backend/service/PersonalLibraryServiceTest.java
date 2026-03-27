package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import dev.pina.backend.domain.PersonalLibrary;
import dev.pina.backend.domain.User;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.Test;

@QuarkusTest
class PersonalLibraryServiceTest {

	@Inject
	PersonalLibraryService personalLibraryService;

	@Inject
	UserResolver userResolver;

	@Test
	@Transactional
	void getOrCreateCreatesLibraryForUser() {
		User user = userResolver.currentUser();
		PersonalLibrary library = personalLibraryService.getOrCreate(user);

		assertNotNull(library);
		assertNotNull(library.id);
		assertEquals(user.id, library.owner.id);
	}

	@Test
	@Transactional
	void getOrCreateReturnsExistingLibrary() {
		User user = userResolver.currentUser();
		PersonalLibrary first = personalLibraryService.getOrCreate(user);
		PersonalLibrary second = personalLibraryService.getOrCreate(user);

		assertEquals(first.id, second.id);
	}
}
