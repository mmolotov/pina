package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.pina.backend.api.dto.AdminMlStatusDto;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * ML enabled but unreachable (dead port): {@link AdminMlService#status()}
 * degrades to the unreachable snapshot.
 */
@QuarkusTest
@TestProfile(AdminMlDegradedTest.DegradedMlProfile.class)
class AdminMlDegradedTest {

	public static class DegradedMlProfile implements QuarkusTestProfile {
		@Override
		public Map<String, String> getConfigOverrides() {
			return Map.of("pina.ml.enabled", "true", "quarkus.grpc.clients.ml.host", "localhost",
					"quarkus.grpc.clients.ml.test-port", "1");
		}
	}

	@Inject
	AdminMlService adminMlService;

	@Test
	void statusIsUnreachableWhenMlDown() {
		AdminMlStatusDto status = adminMlService.status();
		assertTrue(status.enabled());
		assertFalse(status.reachable());
		assertTrue(status.models().isEmpty());
	}
}
