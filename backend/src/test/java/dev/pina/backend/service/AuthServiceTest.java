package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.pina.backend.domain.AuthProvider;
import dev.pina.backend.domain.LinkedAccount;
import dev.pina.backend.domain.PersonalLibrary;
import dev.pina.backend.domain.User;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.transaction.UserTransaction;
import java.util.Optional;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AuthServiceTest {

	@Inject
	AuthService authService;

	@Inject
	UserTransaction tx;

	@Test
	void registerCreatesUserAndLinkedAccountAndLibrary() {
		String username = unique("new-user");
		User user = authService.register(username, "password123", "New User");

		assertNotNull(user.id);
		assertEquals("New User", user.name);
		assertEquals(1L, LinkedAccount.count("provider = ?1 and providerAccountId = ?2", AuthProvider.LOCAL, username));
		assertTrue(PersonalLibrary.find("owner.id", user.id).firstResultOptional().isPresent());
	}

	@Test
	void registerWithoutNameUsesUsername() {
		String username = unique("unnamed-user");
		User user = authService.register(username, "password123", null);
		assertEquals(username, user.name);
	}

	@Test
	void registerDuplicateUsernameThrows() {
		String username = unique("dup-svc");
		authService.register(username, "password123", null);
		assertThrows(UsernameAlreadyExistsException.class, () -> authService.register(username, "password456", null));
	}

	@Test
	void authenticateWithCorrectCredentials() {
		String username = unique("auth-ok");
		authService.register(username, "secret123", "Auth");
		Optional<User> result = authService.authenticate(username, "secret123");
		assertTrue(result.isPresent());
	}

	@Test
	void authenticateWithWrongPassword() {
		String username = unique("auth-bad");
		authService.register(username, "correct123", "Bad");
		Optional<User> result = authService.authenticate(username, "wrongpass123");
		assertTrue(result.isEmpty());
	}

	@Test
	void authenticateNonExistentUser() {
		Optional<User> result = authService.authenticate(unique("ghost-user"), "password123");
		assertTrue(result.isEmpty());
	}

	@Test
	void authenticateInactiveUserReturnsEmpty() {
		String username = unique("inactive-auth");
		User user = authService.register(username, "password123", "Inactive Auth");
		deactivateUser(user);

		Optional<User> result = authService.authenticate(username, "password123");
		assertTrue(result.isEmpty());
	}

	@Test
	void generateAccessTokenReturnsNonBlank() {
		User user = authService.register(unique("token-user"), "password123", null);
		String token = authService.generateAccessToken(user);
		assertNotNull(token);
		assertFalse(token.isBlank());
	}

	@Test
	void createRefreshTokenReturnsNonBlank() {
		User user = authService.register(unique("refresh-svc-user"), "password123", null);
		String refreshToken = authService.createRefreshToken(user);
		assertNotNull(refreshToken);
		assertFalse(refreshToken.isBlank());
		assertEquals(64, refreshToken.length());
	}

	@Test
	void refreshReturnsNewTokenPair() {
		User user = authService.register(unique("refresh-svc-pair"), "password123", null);
		String rawToken = authService.createRefreshToken(user);

		var result = authService.refresh(rawToken);
		assertTrue(result.isPresent());
		assertNotNull(result.get().accessToken());
		assertNotNull(result.get().refreshToken());
	}

	@Test
	void refreshRevokesOldToken() {
		User user = authService.register(unique("refresh-svc-revoke"), "password123", null);
		String rawToken = authService.createRefreshToken(user);

		assertTrue(authService.refresh(rawToken).isPresent());
		assertTrue(authService.refresh(rawToken).isEmpty());
	}

	@Test
	void refreshInactiveUserReturnsEmpty() {
		User user = authService.register(unique("refresh-svc-inactive"), "password123", null);
		String rawToken = authService.createRefreshToken(user);
		deactivateUser(user);

		assertTrue(authService.refresh(rawToken).isEmpty());
	}

	@Test
	void logoutRevokesToken() {
		User user = authService.register(unique("refresh-svc-logout"), "password123", null);
		String rawToken = authService.createRefreshToken(user);

		assertTrue(authService.logout(rawToken));
		assertTrue(authService.refresh(rawToken).isEmpty());
	}

	@Test
	void logoutWithInvalidTokenReturnsFalse() {
		assertFalse(authService.logout("nonexistent-token"));
	}

	private static String unique(String base) {
		return base + "-" + java.util.UUID.randomUUID().toString().substring(0, 8);
	}

	private void deactivateUser(User user) {
		try {
			tx.begin();
			user = User.findById(user.id);
			user.active = false;
			user.persistAndFlush();
			tx.commit();
		} catch (Exception e) {
			try {
				tx.rollback();
			} catch (Exception ignored) {
				// Ignore rollback failures in tests to preserve the original exception.
			}
			throw new RuntimeException(e);
		}
	}
}
