package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.pina.backend.domain.BrowserSession;
import dev.pina.backend.domain.BrowserSessionType;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;

@QuarkusTest
class BrowserSessionServiceTest {

	@Inject
	AuthService authService;

	@Inject
	BrowserSessionService browserSessionService;

	@Inject
	EntityManager em;

	@Test
	@Transactional
	void purgeExpiredAndRevokedSessionsRemovesOnlyInactiveRows() {
		var user = authService.register("session-cleanup-" + UUID.randomUUID().toString().substring(0, 8),
				"password123", "Cleanup User");

		var activeSession = authService.createBrowserSession(user, BrowserSessionType.WEB, "ua", "127.0.0.1").session();
		var expiredSession = authService.createBrowserSession(user, BrowserSessionType.WEB, "ua", "127.0.0.1")
				.session();
		var revokedSession = authService.createBrowserSession(user, BrowserSessionType.WEB, "ua", "127.0.0.1")
				.session();

		expiredSession.expiresAt = OffsetDateTime.now().minusDays(2);
		revokedSession.revokedAt = OffsetDateTime.now().minusDays(2);
		em.flush();

		browserSessionService.purgeExpiredAndRevokedSessions(OffsetDateTime.now());
		em.flush();
		em.clear();

		assertNotNull(BrowserSession.findById(activeSession.id));
		assertNull(BrowserSession.findById(expiredSession.id));
		assertNull(BrowserSession.findById(revokedSession.id));
	}

	@Test
	void authenticateReturnsEmptyForNullToken() {
		assertTrue(browserSessionService.authenticate(null).isEmpty());
	}

	@Test
	void authenticateReturnsEmptyForBlankToken() {
		assertTrue(browserSessionService.authenticate("   ").isEmpty());
	}

	@Test
	@Transactional
	void authenticateReturnsEmptyForRevokedSession() {
		var user = authService.register("session-revoked-" + UUID.randomUUID().toString().substring(0, 8),
				"password123", "Revoked");
		var tokens = authService.createBrowserSession(user, BrowserSessionType.WEB, "ua", "127.0.0.1");
		tokens.session().revokedAt = OffsetDateTime.now();
		em.flush();

		assertTrue(browserSessionService.authenticate(tokens.rawSessionToken()).isEmpty());
	}

	@Test
	@Transactional
	void authenticateReturnsEmptyForExpiredSession() {
		var user = authService.register("session-expired-" + UUID.randomUUID().toString().substring(0, 8),
				"password123", "Expired");
		var tokens = authService.createBrowserSession(user, BrowserSessionType.WEB, "ua", "127.0.0.1");
		tokens.session().expiresAt = OffsetDateTime.now().minusDays(1);
		em.flush();

		assertTrue(browserSessionService.authenticate(tokens.rawSessionToken()).isEmpty());
	}

	@Test
	@Transactional
	void authenticateReturnsEmptyForInactiveUser() {
		var user = authService.register("session-inactive-" + UUID.randomUUID().toString().substring(0, 8),
				"password123", "Inactive");
		var tokens = authService.createBrowserSession(user, BrowserSessionType.WEB, "ua", "127.0.0.1");
		user.active = false;
		em.flush();

		assertTrue(browserSessionService.authenticate(tokens.rawSessionToken()).isEmpty());
	}

	@Test
	void revokeReturnsFalseForNullToken() {
		assertFalse(browserSessionService.revoke(null));
	}

	@Test
	void revokeReturnsFalseForBlankToken() {
		assertFalse(browserSessionService.revoke("   "));
	}

	@Test
	void revokeReturnsFalseForNonExistentToken() {
		assertFalse(browserSessionService.revoke("token-that-matches-no-session-" + UUID.randomUUID()));
	}

	@Test
	@Transactional
	void revokeReturnsFalseForAlreadyRevokedSession() {
		var user = authService.register("session-already-revoked-" + UUID.randomUUID().toString().substring(0, 8),
				"password123", "AlreadyRevoked");
		var tokens = authService.createBrowserSession(user, BrowserSessionType.WEB, "ua", "127.0.0.1");
		tokens.session().revokedAt = OffsetDateTime.now();
		em.flush();

		assertFalse(browserSessionService.revoke(tokens.rawSessionToken()));
	}

	@Test
	void isValidCsrfTokenReturnsFalseForNullStoredHash() {
		assertFalse(browserSessionService.isValidCsrfToken(null, "rawToken"));
	}

	@Test
	void isValidCsrfTokenReturnsFalseForNullRawToken() {
		assertFalse(browserSessionService.isValidCsrfToken("storedHash", null));
	}

	@Test
	void isValidCsrfTokenReturnsFalseForBlankRawToken() {
		assertFalse(browserSessionService.isValidCsrfToken("storedHash", "   "));
	}

	@Test
	void resolveTrustedRemoteAddressReturnsNullForNullContext() {
		assertNull(browserSessionService.resolveTrustedRemoteAddress(null));
	}

	@Test
	@Transactional
	void createBrowserSessionWithNullUserAgentAndAddressStoresNullHashes() {
		var user = authService.register("session-null-meta-" + UUID.randomUUID().toString().substring(0, 8),
				"password123", "NullMeta");
		var tokens = authService.createBrowserSession(user, BrowserSessionType.WEB, null, null);
		assertNotNull(tokens);
		assertNull(tokens.session().userAgentHash);
		assertNull(tokens.session().ipHash);
	}

	@Test
	@Transactional
	void createBrowserSessionWithBlankUserAgentAndAddressStoresNullHashes() {
		var user = authService.register("session-blank-meta-" + UUID.randomUUID().toString().substring(0, 8),
				"password123", "BlankMeta");
		var tokens = authService.createBrowserSession(user, BrowserSessionType.WEB, "  ", "  ");
		assertNotNull(tokens);
		assertNull(tokens.session().userAgentHash);
		assertNull(tokens.session().ipHash);
	}
}
