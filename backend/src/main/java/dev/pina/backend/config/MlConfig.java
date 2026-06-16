package dev.pina.backend.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;
import java.time.Duration;

/**
 * Backend-side ML orchestration settings. The gRPC endpoint itself is
 * configured through the standard quarkus.grpc.clients.ml.* properties.
 */
@ConfigMapping(prefix = "pina.ml")
public interface MlConfig {

	/** Master switch: when false, uploads are never enqueued for analysis. */
	@WithDefault("true")
	boolean enabled();

	/** Worker poll cadence; consumed by the @Scheduled expression. */
	@WithDefault("10s")
	String pollInterval();

	/** Per-call deadline for AnalyzeImage. */
	@WithDefault("PT120S")
	Duration deadline();

	/** Jobs claimed per worker pass. */
	@WithDefault("4")
	int batchSize();

	/** Attempts (including the first) before a job is marked FAILED. */
	@WithDefault("8")
	int maxAttempts();

	/** First retry delay; doubles each attempt. */
	@WithDefault("PT30S")
	Duration backoffBase();

	/** Upper bound for the retry delay. */
	@WithDefault("PT30M")
	Duration backoffCap();

	/**
	 * Max cosine distance between a face descriptor and a cluster centroid for the
	 * face to join that cluster (0.6 ~ ArcFace cosine similarity 0.4).
	 */
	@WithDefault("0.6")
	double faceClusterDistance();
}
