package dev.pina.backend.service;

import dev.pina.backend.config.PhotoConfig;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.concurrent.Semaphore;
import java.util.logging.Logger;

/**
 * Admission control for the image-heavy phase of an upload (decode, EXIF, and
 * variant storage). A blocking semaphore caps the number of uploads that may be
 * in this phase concurrently, so heap usage scales with the cap instead of with
 * HTTP request count. Cheap dedup hits do not consume a slot — callers acquire
 * after the dedup lookup and only when they actually need to do heavy work.
 */
@ApplicationScoped
public class PhotoUploadAdmission {

	private static final Logger LOG = Logger.getLogger(PhotoUploadAdmission.class.getName());

	@Inject
	PhotoConfig photoConfig;

	private Semaphore slots;
	private int capacity;

	@PostConstruct
	void start() {
		int configured = photoConfig.heavyPhase().maxConcurrent();
		capacity = configured > 0 ? configured : Runtime.getRuntime().availableProcessors();
		slots = new Semaphore(capacity, true);
		LOG.info(() -> "PhotoUploadAdmission ready with cap=" + capacity + " (configured=" + configured + ")");
	}

	public Slot acquire() throws InterruptedException {
		slots.acquire();
		return new Slot();
	}

	public int capacity() {
		return capacity;
	}

	public int inFlight() {
		return capacity - slots.availablePermits();
	}

	public final class Slot implements AutoCloseable {

		private boolean released;

		@Override
		public void close() {
			if (!released) {
				released = true;
				slots.release();
			}
		}
	}
}
