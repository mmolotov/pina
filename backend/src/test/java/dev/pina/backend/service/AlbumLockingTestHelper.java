package dev.pina.backend.service;

import dev.pina.backend.domain.Album;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.transaction.Transactional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;

@ApplicationScoped
class AlbumLockingTestHelper {

	@Inject
	EntityManager em;

	@Transactional
	void holdAlbumWriteLock(UUID albumId, CountDownLatch locked, CountDownLatch release) {
		Album album = em.find(Album.class, albumId, LockModeType.PESSIMISTIC_WRITE);
		if (album == null) {
			throw new IllegalArgumentException("Album not found: " + albumId);
		}
		locked.countDown();
		try {
			release.await();
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
			throw new IllegalStateException("Interrupted while holding album lock", e);
		}
	}
}
