package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

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
}
