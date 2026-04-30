package dev.pina.backend.service;

import dev.pina.backend.config.PhotoConfig;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.logging.Logger;

@ApplicationScoped
public class PhotoVariantExecutor {

	private static final Logger LOG = Logger.getLogger(PhotoVariantExecutor.class.getName());

	@Inject
	PhotoConfig photoConfig;

	private ExecutorService executor;

	@PostConstruct
	void start() {
		int configured = photoConfig.variantGeneration().parallelism();
		int parallelism = configured > 0 ? configured : Math.max(1, Runtime.getRuntime().availableProcessors() / 2);
		LOG.info(() -> "PhotoVariantExecutor starting with parallelism=" + parallelism + " (configured=" + configured
				+ ")");
		executor = Executors.newFixedThreadPool(parallelism, daemonThreadFactory());
	}

	@PreDestroy
	void stop() {
		if (executor != null) {
			executor.shutdownNow();
		}
	}

	public ExecutorService executor() {
		return executor;
	}

	private static ThreadFactory daemonThreadFactory() {
		AtomicInteger counter = new AtomicInteger();
		return runnable -> {
			Thread thread = new Thread(runnable, "pina-variant-" + counter.incrementAndGet());
			thread.setDaemon(true);
			return thread;
		};
	}
}
