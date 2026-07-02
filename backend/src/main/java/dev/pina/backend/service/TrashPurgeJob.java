package dev.pina.backend.service;

import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Periodically purges trashed photos and albums whose retention window has
 * elapsed. Modeled on {@link BrowserSessionCleanupJob}; the work and its
 * transaction live in {@link TrashService#purgeExpired(OffsetDateTime)}.
 * Overlapping runs are skipped so a slow sweep never stacks.
 */
@ApplicationScoped
public class TrashPurgeJob {

	private static final Logger LOG = Logger.getLogger(TrashPurgeJob.class.getName());

	@Inject
	TrashService trashService;

	@Scheduled(every = "{pina.trash.purge.interval}", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
	void purgeExpired() {
		TrashService.PurgeStats stats = trashService.purgeExpired(OffsetDateTime.now());
		if (stats.total() > 0) {
			LOG.log(Level.INFO, "Trash purge removed {0} photo(s) and {1} album(s)",
					new Object[]{stats.photos(), stats.albums()});
		}
	}
}
