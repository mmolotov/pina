package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.pina.backend.api.dto.AdminMlStatusDto;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Exercises {@link AdminMlService#status()} against the reachable
 * {@link FakeImageAnalysisService}, covering the license / profile /
 * inference-setting mapping added in Part C2.
 */
@QuarkusTest
@TestProfile(AdminMlReachableTest.ReachableMlProfile.class)
class AdminMlReachableTest {

	public static class ReachableMlProfile implements QuarkusTestProfile {
		@Override
		public Map<String, String> getConfigOverrides() {
			return Map.of("pina.ml.enabled", "true", "quarkus.grpc.clients.ml.host", "localhost",
					"quarkus.grpc.clients.ml.test-port", "9001");
		}
	}

	@Inject
	AdminMlService adminMlService;

	@Test
	void statusReflectsReachableServiceAndLicenses() {
		AdminMlStatusDto status = adminMlService.status();

		assertTrue(status.enabled());
		assertTrue(status.reachable());
		assertEquals("0.1.0-test", status.serviceVersion());
		assertEquals(4, status.models().size());

		AdminMlStatusDto.Model clip = model(status, "clip-test");
		assertNotNull(clip.license());
		assertEquals("MIT", clip.license().spdx());
		assertNotNull(clip.license().url());
		assertTrue(clip.license().commercialUse());

		// License without url/notes -> emptyToNull yields null.
		assertNull(model(status, "text-test").license().url());
		// Non-commercial, bundling forbidden.
		assertFalse(model(status, "det-test").license().commercialUse());
		// No license at all.
		assertNull(model(status, "rec-test").license());

		assertNotNull(status.profile());
		assertEquals("default", status.profile().name());
		assertEquals(4, status.profile().maxParallelAnalyses());
		assertEquals(1, status.profile().executionProviders().size());
		assertFalse(status.inferenceSettings().isEmpty());
		assertEquals("PINA_ML_TAG_TOP_K", status.inferenceSettings().get(0).key());
	}

	private static AdminMlStatusDto.Model model(AdminMlStatusDto status, String modelId) {
		return status.models().stream().filter(m -> m.modelId().equals(modelId)).findFirst().orElseThrow();
	}
}
