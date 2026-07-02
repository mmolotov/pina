package dev.pina.backend.service;

import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.pina.backend.domain.AnalysisJobStatus;
import dev.pina.backend.domain.PhotoAnalysisJob;
import dev.pina.backend.domain.PhotoEmbedding;
import dev.pina.backend.domain.PhotoFace;
import dev.pina.backend.domain.PhotoTag;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(MlAnalysisServiceTest.FakeMlProfile.class)
class MlAnalysisServiceTest {

	/**
	 * Points the ML client at the Quarkus test gRPC server, which hosts
	 * {@link FakeImageAnalysisService}. In test mode the client resolves its target
	 * through test-port (default 9001 = the local test gRPC server).
	 */
	public static class FakeMlProfile implements QuarkusTestProfile {
		@Override
		public Map<String, String> getConfigOverrides() {
			return Map.of("pina.ml.enabled", "true", "pina.ml.poll-interval", "1s", "pina.ml.backoff-base", "PT1S",
					"pina.ml.deadline", "PT10S", "quarkus.grpc.clients.ml.host", "localhost",
					"quarkus.grpc.clients.ml.test-port", "9001");
		}
	}

	private static final Duration WAIT = Duration.ofSeconds(30);

	@Inject
	MlAnalysisService mlAnalysisService;

	@BeforeEach
	void resetFakeServer() {
		FakeImageAnalysisService.HANDLER.set(null);
	}

	@Test
	void fullAnalysisPersistsOutputsWithProvenance() throws IOException {
		FakeImageAnalysisService.HANDLER
				.set(request -> FakeImageAnalysisService.fullSuccess(request, FakeImageAnalysisService.unitVector(7)));
		UUID photoId = uploadPhoto("ml-full", 0x112233);

		PhotoAnalysisJob job = awaitJob(photoId, AnalysisJobStatus.COMPLETED);
		assertNull(job.lastError);

		QuarkusTransaction.requiringNew().run(() -> {
			PhotoEmbedding embedding = PhotoEmbedding.findById(photoId);
			assertNotNull(embedding, "embedding row");
			assertEquals(PhotoEmbedding.DIMENSION, embedding.embedding.length);
			assertEquals(1.0f, embedding.embedding[7]);
			assertEquals("clip-test", embedding.modelId);
			assertEquals("1.0", embedding.modelVersion);

			List<PhotoTag> tags = PhotoTag.listByPhotoId(photoId);
			assertEquals(2, tags.size());
			assertEquals("beach", tags.get(0).label);
			assertEquals("text-test", tags.get(0).modelId);

			List<PhotoFace> faces = PhotoFace.listByPhotoId(photoId);
			assertEquals(1, faces.size());
			PhotoFace face = faces.get(0);
			assertEquals(0.1f, face.bboxX);
			assertEquals(0.95f, face.confidence);
			assertNotNull(face.descriptor);
			assertEquals(PhotoEmbedding.DIMENSION, face.descriptor.length);
			assertEquals("det-test", face.modelId);
		});
	}

	@Test
	void duplicateUploadKeepsSingleJob() throws IOException {
		Path image = createJpegImage("ml-dup", 90, 90, 0x445566);
		String token = registerUserToken("dup");
		String firstId = uploadFile(token, image);
		String secondId = uploadFile(token, image);
		assertEquals(firstId, secondId);

		UUID photoId = UUID.fromString(firstId);
		awaitJob(photoId, AnalysisJobStatus.COMPLETED);
		long jobCount = QuarkusTransaction.requiringNew().call(() -> PhotoAnalysisJob.count("photoId", photoId));
		assertEquals(1, jobCount);
	}

	@Test
	void partialFailureRetriesUntilComplete() throws IOException {
		AtomicInteger calls = new AtomicInteger();
		FakeImageAnalysisService.HANDLER.set(request -> calls.incrementAndGet() == 1
				? FakeImageAnalysisService.partialFaceFailure(request, FakeImageAnalysisService.unitVector(1))
				: FakeImageAnalysisService.fullSuccess(request, FakeImageAnalysisService.unitVector(1)));
		UUID photoId = uploadPhoto("ml-partial", 0x223344);

		PhotoAnalysisJob job = awaitJob(photoId, AnalysisJobStatus.COMPLETED);
		assertTrue(job.attempts >= 2, "expected at least two attempts, got " + job.attempts);
		assertTrue(calls.get() >= 2);

		QuarkusTransaction.requiringNew().run(() -> {
			assertNotNull(PhotoEmbedding.findById(photoId));
			assertEquals(1, PhotoFace.listByPhotoId(photoId).size());
		});
	}

	@Test
	void invalidInputFailsTerminally() throws IOException {
		FakeImageAnalysisService.HANDLER.set(request -> {
			throw io.grpc.Status.INVALID_ARGUMENT.withDescription("cannot decode").asRuntimeException();
		});
		UUID photoId = uploadPhoto("ml-invalid", 0x334455);

		PhotoAnalysisJob job = awaitJob(photoId, AnalysisJobStatus.FAILED);
		assertEquals(1, job.attempts);
		assertNotNull(job.lastError);
		assertTrue(job.lastError.contains("ML rejected input"), job.lastError);
	}

	@Test
	void nearestNeighborQueryOrdersByCosineDistance() throws IOException {
		AtomicInteger counter = new AtomicInteger();
		FakeImageAnalysisService.HANDLER.set(request -> FakeImageAnalysisService.fullSuccess(request,
				FakeImageAnalysisService.unitVector(counter.getAndIncrement())));

		// All three photos belong to one owner so the access-scoped query returns
		// them; they get distinct basis vectors (0, 1, 2) in upload order.
		String ownerToken = registerUserToken("nn-owner");
		UUID ownerId = userId(ownerToken);
		UUID first = UUID.fromString(uploadFile(ownerToken, createJpegImage("ml-nn-a", 100, 100, 0x010101)));
		awaitJob(first, AnalysisJobStatus.COMPLETED);
		UUID second = UUID.fromString(uploadFile(ownerToken, createJpegImage("ml-nn-b", 100, 100, 0x020202)));
		awaitJob(second, AnalysisJobStatus.COMPLETED);
		UUID third = UUID.fromString(uploadFile(ownerToken, createJpegImage("ml-nn-c", 100, 100, 0x030303)));
		awaitJob(third, AnalysisJobStatus.COMPLETED);

		UUID expectedNearest = QuarkusTransaction.requiringNew().call(() -> {
			for (UUID photoId : List.of(first, second, third)) {
				PhotoEmbedding embedding = PhotoEmbedding.findById(photoId);
				if (embedding != null && embedding.embedding[1] == 1.0f) {
					return photoId;
				}
			}
			throw new AssertionError("No photo got the unit vector at index 1");
		});

		List<UUID> nearest = QuarkusTransaction.requiringNew().call(() -> mlAnalysisService
				.findNearestAccessiblePhotoIds(ownerId, Set.of(), FakeImageAnalysisService.unitVector(1), 3));
		assertEquals(expectedNearest, nearest.get(0));
		assertEquals(3, nearest.size());
	}

	@Test
	void nearestNeighborQueryExcludesInaccessiblePhotos() throws IOException {
		// Every photo gets the exact query vector, so cosine distance alone cannot
		// separate them - only access scoping can keep another owner's photo out.
		FakeImageAnalysisService.HANDLER
				.set(request -> FakeImageAnalysisService.fullSuccess(request, FakeImageAnalysisService.unitVector(1)));

		String ownerToken = registerUserToken("nn-owner");
		UUID ownerId = userId(ownerToken);
		UUID ownerPhoto = UUID.fromString(uploadFile(ownerToken, createJpegImage("ml-nn-own", 100, 100, 0x111111)));
		awaitJob(ownerPhoto, AnalysisJobStatus.COMPLETED);

		String intruderToken = registerUserToken("nn-intruder");
		UUID intruderPhoto = UUID
				.fromString(uploadFile(intruderToken, createJpegImage("ml-nn-int", 100, 100, 0x222222)));
		awaitJob(intruderPhoto, AnalysisJobStatus.COMPLETED);

		List<UUID> nearest = QuarkusTransaction.requiringNew().call(() -> mlAnalysisService
				.findNearestAccessiblePhotoIds(ownerId, Set.of(), FakeImageAnalysisService.unitVector(1), 10));

		assertEquals(List.of(ownerPhoto), nearest);
		assertFalse(nearest.contains(intruderPhoto), "another owner's photo must never surface");
	}

	@Test
	void adminHealthReportsReachableMlService() {
		String token = registerAdminToken();
		given().header("Authorization", "Bearer " + token).when().get("/api/v1/admin/health").then().statusCode(200)
				.body("ml.enabled", org.hamcrest.Matchers.equalTo(true))
				.body("ml.reachable", org.hamcrest.Matchers.equalTo(true))
				.body("ml.activeProfile", org.hamcrest.Matchers.equalTo("default"))
				.body("ml.ready", org.hamcrest.Matchers.equalTo(true))
				.body("ml.modelsAvailable", org.hamcrest.Matchers.equalTo(4))
				.body("ml.modelsTotal", org.hamcrest.Matchers.equalTo(4));
	}

	private String registerAdminToken() {
		String username = "ml-admin-" + UUID.randomUUID().toString().substring(0, 8);
		String password = "testpass123";
		given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201);
		String token = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}").when()
				.post("/api/v1/auth/login").then().statusCode(200).extract().path("accessToken");
		String userId = given().header("Authorization", "Bearer " + token).when().get("/api/v1/auth/me").then()
				.statusCode(200).extract().path("id");
		QuarkusTransaction.requiringNew()
				.run(() -> dev.pina.backend.domain.User.update("instanceRole = ?1 where id = ?2",
						dev.pina.backend.domain.InstanceRole.ADMIN, UUID.fromString(userId)));
		return given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}").when()
				.post("/api/v1/auth/login").then().statusCode(200).extract().path("accessToken");
	}

	@Test
	void purgingPhotoCascadesMlRows() throws IOException {
		Path image = createJpegImage("ml-del", 80, 80, 0x556677);
		String token = registerUserToken("del");
		UUID photoId = UUID.fromString(uploadFile(token, image));
		awaitJob(photoId, AnalysisJobStatus.COMPLETED);

		// Soft-delete moves the photo to the trash but keeps its ML rows, so a
		// restore brings the analysis back with it.
		given().header("Authorization", "Bearer " + token).when().delete("/api/v1/photos/{id}", photoId).then()
				.statusCode(204);
		QuarkusTransaction.requiringNew().run(() -> {
			assertTrue(PhotoEmbedding.findById(photoId) != null);
			assertTrue(!PhotoAnalysisJob.findByPhotoId(photoId).isEmpty());
		});

		// Purge permanently deletes the photo; PostgreSQL cascades every ML row.
		given().header("Authorization", "Bearer " + token).contentType(ContentType.JSON)
				.body("{\"items\":[{\"kind\":\"PHOTO\",\"id\":\"" + photoId + "\"}]}").when()
				.post("/api/v1/trash/purge").then().statusCode(204);
		QuarkusTransaction.requiringNew().run(() -> {
			assertNull(PhotoEmbedding.findById(photoId));
			assertEquals(0, PhotoTag.listByPhotoId(photoId).size());
			assertEquals(0, PhotoFace.listByPhotoId(photoId).size());
			assertTrue(PhotoAnalysisJob.findByPhotoId(photoId).isEmpty());
		});
	}

	// --- helpers ---

	private PhotoAnalysisJob awaitJob(UUID photoId, AnalysisJobStatus expected) {
		return await("job " + expected + " for photo " + photoId, () -> QuarkusTransaction.requiringNew()
				.call(() -> PhotoAnalysisJob.findByPhotoId(photoId).filter(job -> job.status == expected)));
	}

	private static <T> T await(String what, Supplier<Optional<T>> probe) {
		long deadline = System.nanoTime() + WAIT.toNanos();
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

	private UUID uploadPhoto(String prefix, int rgb) throws IOException {
		Path image = createJpegImage(prefix, 100, 100, rgb);
		return UUID.fromString(uploadFile(registerUserToken(prefix), image));
	}

	private String uploadFile(String token, Path image) {
		return given().header("Authorization", "Bearer " + token).multiPart("file", image.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
	}

	private UUID userId(String token) {
		return UUID.fromString(given().header("Authorization", "Bearer " + token).when().get("/api/v1/auth/me").then()
				.statusCode(200).extract().path("id"));
	}

	private Path createJpegImage(String prefix, int width, int height, int rgb) throws IOException {
		Path image = Files.createTempFile(prefix, ".jpg");
		BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
		var graphics = img.createGraphics();
		graphics.setColor(new java.awt.Color(rgb));
		graphics.fillRect(0, 0, width, height);
		graphics.dispose();
		ImageIO.write(img, "jpg", image.toFile());
		return image;
	}

	private String registerUserToken(String suffix) {
		String username = "ml-test-" + suffix + "-" + UUID.randomUUID().toString().substring(0, 8);
		return given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");
	}
}
