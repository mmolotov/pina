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
		User user = authService.register("new-user", "password123", "New User");

		assertNotNull(user.id);
		assertEquals("New User", user.name);
		assertEquals(1L,
				LinkedAccount.count("provider = ?1 and providerAccountId = ?2", AuthProvider.LOCAL, "new-user"));
		assertTrue(PersonalLibrary.find("owner.id", user.id).firstResultOptional().isPresent());
	}

	@Test
	void registerWithoutNameUsesUsername() {
		User user = authService.register("unnamed-user", "password123", null);
		assertEquals("unnamed-user", user.name);
	}

	@Test
	void registerDuplicateUsernameThrows() {
		authService.register("dup-svc", "password123", null);
		assertThrows(UsernameAlreadyExistsException.class, () -> authService.register("dup-svc", "password456", null));
	}

	@Test
	void authenticateWithCorrectCredentials() {
		authService.register("auth-ok", "secret123", "Auth");
		Optional<User> result = authService.authenticate("auth-ok", "secret123");
		assertTrue(result.isPresent());
	}

	@Test
	void authenticateWithWrongPassword() {
		authService.register("auth-bad", "correct123", "Bad");
		Optional<User> result = authService.authenticate("auth-bad", "wrongpass123");
		assertTrue(result.isEmpty());
	}

	@Test
	void authenticateNonExistentUser() {
		Optional<User> result = authService.authenticate("ghost-user", "password123");
		assertTrue(result.isEmpty());
	}

	@Test
	void authenticateInactiveUserReturnsEmpty() {
		User user = authService.register("inactive-auth", "password123", "Inactive Auth");
		deactivateUser(user);

		Optional<User> result = authService.authenticate("inactive-auth", "password123");
		assertTrue(result.isEmpty());
	}

	@Test
	void generateAccessTokenReturnsNonBlank() {
		User user = authService.register("token-user", "password123", null);
		String token = authService.generateAccessToken(user);
		assertNotNull(token);
		assertFalse(token.isBlank());
	}

	@Test
	void createRefreshTokenReturnsNonBlank() {
		User user = authService.register("refresh-svc-user", "password123", null);
		String refreshToken = authService.createRefreshToken(user);
		assertNotNull(refreshToken);
		assertFalse(refreshToken.isBlank());
		assertEquals(64, refreshToken.length());
	}

	@Test
	void refreshReturnsNewTokenPair() {
		User user = authService.register("refresh-svc-pair", "password123", null);
		String rawToken = authService.createRefreshToken(user);

		var result = authService.refresh(rawToken);
		assertTrue(result.isPresent());
		assertNotNull(result.get().accessToken());
		assertNotNull(result.get().refreshToken());
	}

	@Test
	void refreshRevokesOldToken() {
		User user = authService.register("refresh-svc-revoke", "password123", null);
		String rawToken = authService.createRefreshToken(user);

		assertTrue(authService.refresh(rawToken).isPresent());
		assertTrue(authService.refresh(rawToken).isEmpty());
	}

	@Test
	void refreshInactiveUserReturnsEmpty() {
		User user = authService.register("refresh-svc-inactive", "password123", null);
		String rawToken = authService.createRefreshToken(user);
		deactivateUser(user);

		assertTrue(authService.refresh(rawToken).isEmpty());
	}

	@Test
	void logoutRevokesToken() {
		User user = authService.register("refresh-svc-logout", "password123", null);
		String rawToken = authService.createRefreshToken(user);

		assertTrue(authService.logout(rawToken));
		assertTrue(authService.refresh(rawToken).isEmpty());
	}

	@Test
	void logoutWithInvalidTokenReturnsFalse() {
		assertFalse(authService.logout("nonexistent-token"));
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
