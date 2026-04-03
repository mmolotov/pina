package dev.pina.backend.api;

import io.quarkus.test.junit.QuarkusTestProfile;
import java.util.Map;

public class AuthRateLimitTestProfile implements QuarkusTestProfile {

	@Override
	public Map<String, String> getConfigOverrides() {
		return Map.of("pina.auth.rate-limit.enabled", "true", "pina.auth.rate-limit.max-attempts", "2",
				"pina.auth.rate-limit.window-seconds", "60");
	}
}
