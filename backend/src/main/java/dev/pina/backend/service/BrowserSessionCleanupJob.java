package dev.pina.backend.service;

import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.time.OffsetDateTime;

@ApplicationScoped
public class BrowserSessionCleanupJob {

	@Inject
	BrowserSessionService browserSessionService;

	@Scheduled(every = "{pina.auth.browser-session.cleanup.interval}")
	@Transactional
	void purgeExpiredAndRevokedSessions() {
		browserSessionService.purgeExpiredAndRevokedSessions(OffsetDateTime.now());
	}
}
