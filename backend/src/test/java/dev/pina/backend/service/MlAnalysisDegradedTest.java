package dev.pina.backend.service;

import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.pina.backend.domain.AnalysisJobStatus;
import dev.pina.backend.domain.PhotoAnalysisJob;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.restassured.http.ContentType;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

/**
 * ML endpoint points at a closed port: uploads must stay unaffected and jobs
 * must remain on a retryable path instead of being dropped.
 */
@QuarkusTest
@TestProfile(MlAnalysisDegradedTest.DegradedMlProfile.class)
class MlAnalysisDegradedTest {

	public static class DegradedMlProfile implements QuarkusTestProfile {
		@Override
		public Map<String, String> getConfigOverrides() {
			// In test mode the gRPC client ignores `port` and uses `test-port`
			// (defaulting to the local test gRPC server), so the closed port
			// must be configured through test-port.
			return Map.of("pina.ml.enabled", "true", "pina.ml.poll-interval", "1s", "pina.ml.backoff-base", "PT1S",
					"pina.ml.deadline", "PT2S", "quarkus.grpc.clients.ml.host", "localhost",
					"quarkus.grpc.clients.ml.test-port", "1");
		}
	}

	@Test
	void uploadSucceedsAndJobStaysRetryableWhileMlIsDown() throws IOException {
		Path image = Files.createTempFile("ml-degraded", ".jpg");
		BufferedImage img = new BufferedImage(90, 90, BufferedImage.TYPE_INT_RGB);
		var graphics = img.createGraphics();
		graphics.setColor(new java.awt.Color(0x667788));
		graphics.fillRect(0, 0, 90, 90);
		graphics.dispose();
		ImageIO.write(img, "jpg", image.toFile());

		String username = "ml-degraded-" + UUID.randomUUID().toString().substring(0, 8);
		String token = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");

		// The upload itself must succeed even though ML is unreachable.
		String photoId = given().header("Authorization", "Bearer " + token)
				.multiPart("file", image.toFile(), "image/jpeg").when().post("/api/v1/photos").then().statusCode(201)
				.extract().path("id");

		PhotoAnalysisJob job = await("retryable job",
				() -> QuarkusTransaction.requiringNew()
						.call(() -> PhotoAnalysisJob.findByPhotoId(UUID.fromString(photoId))
								.filter(candidate -> candidate.attempts >= 1 && candidate.lastError != null)));

		assertEquals(AnalysisJobStatus.PENDING, job.status, "job must stay retryable");
		assertNotNull(job.lastError);
		assertTrue(job.nextAttemptAt.isAfter(OffsetDateTime.now().minusSeconds(1)),
				"next attempt must be scheduled, got " + job.nextAttemptAt);
	}

	private static <T> T await(String what, Supplier<Optional<T>> probe) {
		long deadline = System.nanoTime() + Duration.ofSeconds(30).toNanos();
		while (System.nanoTime() < deadline) {
			Optional<T> result = probe.get();
			if (result.isPresent()) {
				return result.get();
			}
			try {
				Thread.sleep(150);
			} catch (InterruptedException e) {
				Thread.currentThread().interrupt();
				throw new AssertionError("Interrupted while waiting for " + what, e);
			}
		}
		throw new AssertionError("Timed out waiting for " + what);
	}
}
