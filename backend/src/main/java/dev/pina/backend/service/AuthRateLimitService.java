package dev.pina.backend.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.Duration;
import java.time.Instant;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class AuthRateLimitService {

	private Cache<String, CounterState> counters;

	@ConfigProperty(name = "pina.auth.rate-limit.enabled", defaultValue = "true")
	boolean enabled;

	@ConfigProperty(name = "pina.auth.rate-limit.window-seconds", defaultValue = "60")
	long windowSeconds;

	@ConfigProperty(name = "pina.auth.rate-limit.max-attempts", defaultValue = "30")
	int maxAttempts;

	@ConfigProperty(name = "pina.auth.rate-limit.max-counters", defaultValue = "100000")
	long maxCounters;

	AuthRateLimitService() {
	}

	static AuthRateLimitService forTesting(boolean enabled, long windowSeconds, int maxAttempts, long maxCounters) {
		AuthRateLimitService service = new AuthRateLimitService();
		service.enabled = enabled;
		service.windowSeconds = windowSeconds;
		service.maxAttempts = maxAttempts;
		service.maxCounters = maxCounters;
		service.init();
		return service;
	}

	@PostConstruct
	void init() {
		counters = Caffeine.newBuilder().maximumSize(Math.max(1L, maxCounters))
				.expireAfterWrite(Duration.ofSeconds(Math.max(1L, windowSeconds))).build();
	}

	public RateLimitDecision check(String key) {
		if (!enabled || key == null || key.isBlank()) {
			return RateLimitDecision.allow();
		}

		long nowMillis = Instant.now().toEpochMilli();
		long windowMillis = Math.max(1L, windowSeconds * 1000L);
		DecisionHolder holder = new DecisionHolder();

		counters.asMap().compute(key, (_, existing) -> {
			if (existing == null || nowMillis - existing.windowStartedAtMillis() >= windowMillis) {
				holder.decision = RateLimitDecision.allow();
				return new CounterState(nowMillis, 1);
			}

			int nextAttempts = existing.attempts() + 1;
			if (nextAttempts <= maxAttempts) {
				holder.decision = RateLimitDecision.allow();
				return new CounterState(existing.windowStartedAtMillis(), nextAttempts);
			}

			long retryAfterSeconds = Math.max(1L,
					(windowMillis - (nowMillis - existing.windowStartedAtMillis()) + 999L) / 1000L);
			holder.decision = RateLimitDecision.deny(retryAfterSeconds);
			return existing;
		});

		return holder.decision != null ? holder.decision : RateLimitDecision.allow();
	}

	long estimatedCounterCount() {
		return counters.estimatedSize();
	}

	void cleanUp() {
		counters.cleanUp();
	}

	private record CounterState(long windowStartedAtMillis, int attempts) {
	}

	private static final class DecisionHolder {

		private RateLimitDecision decision;
	}

	public record RateLimitDecision(boolean allowed, long retryAfterSeconds) {

		public static RateLimitDecision allow() {
			return new RateLimitDecision(true, 0);
		}

		public static RateLimitDecision deny(long retryAfterSeconds) {
			return new RateLimitDecision(false, retryAfterSeconds);
		}
	}
}
