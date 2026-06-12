package dev.pina.backend.service;

import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.pina.backend.domain.AnalysisJobStatus;
import dev.pina.backend.domain.FaceCluster;
import dev.pina.backend.domain.PhotoAnalysisJob;
import dev.pina.backend.domain.PhotoEmbedding;
import dev.pina.backend.domain.PhotoFace;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.restassured.http.ContentType;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(MlAnalysisServiceTest.FakeMlProfile.class)
class FaceClusterIngestionTest {

	private static final Duration WAIT = Duration.ofSeconds(30);

	@BeforeEach
	void resetFakeServer() {
		FakeImageAnalysisService.HANDLER.set(null);
	}

	@Test
	void sameDescriptorAcrossPhotosJoinsOneCluster() throws IOException {
		float[] descriptor = FakeImageAnalysisService.unitVector(5);
		FakeImageAnalysisService.HANDLER.set(request -> FakeImageAnalysisService.withFaces(request,
				FakeImageAnalysisService.unitVector(0), new float[][]{descriptor}));
		String token = registerUserToken("fc-same");

		UUID firstPhoto = uploadFile(token, createJpegImage("fc-same-1", 0x101010));
		awaitJob(firstPhoto, AnalysisJobStatus.COMPLETED);
		UUID secondPhoto = uploadFile(token, createJpegImage("fc-same-2", 0x202020));
		awaitJob(secondPhoto, AnalysisJobStatus.COMPLETED);

		QuarkusTransaction.requiringNew().run(() -> {
			PhotoFace firstFace = PhotoFace.listByPhotoId(firstPhoto).get(0);
			PhotoFace secondFace = PhotoFace.listByPhotoId(secondPhoto).get(0);
			assertNotNull(firstFace.clusterId);
			assertEquals(firstFace.clusterId, secondFace.clusterId);

			FaceCluster cluster = FaceCluster.findById(firstFace.clusterId);
			assertEquals(2, cluster.centroidWeight);
			assertEquals(1, FaceCluster.count("ownerId", cluster.ownerId));
			assertEquals(1.0f, cluster.centroid[5], 1.0e-4f);
			assertNorm(cluster.centroid);
		});
	}

	@Test
	void distinctFacesInOnePhotoCreateSeparateClusters() throws IOException {
		FakeImageAnalysisService.HANDLER
				.set(request -> FakeImageAnalysisService.withFaces(request, FakeImageAnalysisService.unitVector(0),
						new float[][]{FakeImageAnalysisService.unitVector(1), FakeImageAnalysisService.unitVector(2)}));
		String token = registerUserToken("fc-distinct");
		UUID photoId = uploadFile(token, createJpegImage("fc-distinct", 0x303030));
		awaitJob(photoId, AnalysisJobStatus.COMPLETED);

		QuarkusTransaction.requiringNew().run(() -> {
			List<PhotoFace> faces = PhotoFace.listByPhotoId(photoId);
			assertEquals(2, faces.size());
			assertNotNull(faces.get(0).clusterId);
			assertNotNull(faces.get(1).clusterId);
			assertNotEquals(faces.get(0).clusterId, faces.get(1).clusterId);
		});
	}

	@Test
	void nearDuplicateJoinsExistingClusterIncrementally() throws IOException {
		float[] seed = FakeImageAnalysisService.unitVector(0);
		float[] near = mix(0, 0.8f, 1, 0.6f); // cosine 0.8 to seed -> distance 0.2
		String token = registerUserToken("fc-near");

		FakeImageAnalysisService.HANDLER.set(request -> FakeImageAnalysisService.withFaces(request,
				FakeImageAnalysisService.unitVector(0), new float[][]{seed}));
		UUID firstPhoto = uploadFile(token, createJpegImage("fc-near-1", 0x404040));
		awaitJob(firstPhoto, AnalysisJobStatus.COMPLETED);

		FakeImageAnalysisService.HANDLER.set(request -> FakeImageAnalysisService.withFaces(request,
				FakeImageAnalysisService.unitVector(0), new float[][]{near}));
		UUID secondPhoto = uploadFile(token, createJpegImage("fc-near-2", 0x505050));
		awaitJob(secondPhoto, AnalysisJobStatus.COMPLETED);

		QuarkusTransaction.requiringNew().run(() -> {
			PhotoFace firstFace = PhotoFace.listByPhotoId(firstPhoto).get(0);
			PhotoFace secondFace = PhotoFace.listByPhotoId(secondPhoto).get(0);
			assertEquals(firstFace.clusterId, secondFace.clusterId, "near-duplicate must join the existing cluster");

			FaceCluster cluster = FaceCluster.findById(firstFace.clusterId);
			assertEquals(2, cluster.centroidWeight);
			assertEquals(1, FaceCluster.count("ownerId", cluster.ownerId));
			assertNorm(cluster.centroid);
			assertTrue(cluster.centroid[0] > cluster.centroid[1], "centroid must lean toward the seed direction");
		});
	}

	@Test
	void orthogonalDescriptorNeverMerges() throws IOException {
		String token = registerUserToken("fc-ortho");

		FakeImageAnalysisService.HANDLER.set(request -> FakeImageAnalysisService.withFaces(request,
				FakeImageAnalysisService.unitVector(0), new float[][]{FakeImageAnalysisService.unitVector(3)}));
		UUID firstPhoto = uploadFile(token, createJpegImage("fc-ortho-1", 0x606060));
		awaitJob(firstPhoto, AnalysisJobStatus.COMPLETED);

		FakeImageAnalysisService.HANDLER.set(request -> FakeImageAnalysisService.withFaces(request,
				FakeImageAnalysisService.unitVector(0), new float[][]{FakeImageAnalysisService.unitVector(4)}));
		UUID secondPhoto = uploadFile(token, createJpegImage("fc-ortho-2", 0x707070));
		awaitJob(secondPhoto, AnalysisJobStatus.COMPLETED);

		QuarkusTransaction.requiringNew().run(() -> {
			PhotoFace firstFace = PhotoFace.listByPhotoId(firstPhoto).get(0);
			PhotoFace secondFace = PhotoFace.listByPhotoId(secondPhoto).get(0);
			assertNotEquals(firstFace.clusterId, secondFace.clusterId, "orthogonal descriptors must not merge");

			FaceCluster first = FaceCluster.findById(firstFace.clusterId);
			assertEquals(1, first.centroidWeight);
			assertEquals(2, FaceCluster.count("ownerId", first.ownerId));
		});
	}

	@Test
	void clustersAreOwnerScoped() throws IOException {
		float[] descriptor = FakeImageAnalysisService.unitVector(7);
		FakeImageAnalysisService.HANDLER.set(request -> FakeImageAnalysisService.withFaces(request,
				FakeImageAnalysisService.unitVector(0), new float[][]{descriptor}));

		UUID photoA = uploadFile(registerUserToken("fc-owner-a"), createJpegImage("fc-owner-a", 0x808080));
		awaitJob(photoA, AnalysisJobStatus.COMPLETED);
		UUID photoB = uploadFile(registerUserToken("fc-owner-b"), createJpegImage("fc-owner-b", 0x909090));
		awaitJob(photoB, AnalysisJobStatus.COMPLETED);

		QuarkusTransaction.requiringNew().run(() -> {
			PhotoFace faceA = PhotoFace.listByPhotoId(photoA).get(0);
			PhotoFace faceB = PhotoFace.listByPhotoId(photoB).get(0);
			assertNotEquals(faceA.clusterId, faceB.clusterId, "clusters must not cross user boundaries");

			FaceCluster clusterA = FaceCluster.findById(faceA.clusterId);
			FaceCluster clusterB = FaceCluster.findById(faceB.clusterId);
			assertNotEquals(clusterA.ownerId, clusterB.ownerId);
		});
	}

	@Test
	void facesWithoutDescriptorsStayUnassigned() throws IOException {
		FakeImageAnalysisService.HANDLER.set(request -> FakeImageAnalysisService.detectionsWithoutDescriptors(request,
				FakeImageAnalysisService.unitVector(0), 2));
		String token = registerUserToken("fc-nodesc");
		UUID photoId = uploadFile(token, createJpegImage("fc-nodesc", 0xa0a0a0));
		awaitJob(photoId, AnalysisJobStatus.COMPLETED);

		QuarkusTransaction.requiringNew().run(() -> {
			List<PhotoFace> faces = PhotoFace.listByPhotoId(photoId);
			assertEquals(2, faces.size());
			for (PhotoFace face : faces) {
				assertNull(face.descriptor);
				assertNull(face.clusterId);
			}
		});
	}

	// --- helpers ---

	private static float[] mix(int firstIndex, float firstWeight, int secondIndex, float secondWeight) {
		float[] vector = new float[PhotoEmbedding.DIMENSION];
		vector[firstIndex] = firstWeight;
		vector[secondIndex] = secondWeight;
		return FaceClusterService.normalize(vector);
	}

	private static void assertNorm(float[] vector) {
		double sumOfSquares = 0.0;
		for (float value : vector) {
			sumOfSquares += (double) value * value;
		}
		assertEquals(1.0, Math.sqrt(sumOfSquares), 1.0e-4, "centroid must stay L2-normalized");
	}

	private PhotoAnalysisJob awaitJob(UUID photoId, AnalysisJobStatus expected) {
		long deadline = System.nanoTime() + WAIT.toNanos();
		while (System.nanoTime() < deadline) {
			Optional<PhotoAnalysisJob> job = QuarkusTransaction.requiringNew().call(
					() -> PhotoAnalysisJob.findByPhotoId(photoId).filter(candidate -> candidate.status == expected));
			if (job.isPresent()) {
				return job.get();
			}
			sleep();
		}
		throw new AssertionError("Timed out waiting for job " + expected + " for photo " + photoId);
	}

	private static void sleep() {
		try {
			Thread.sleep(150);
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
			throw new AssertionError("Interrupted while waiting", e);
		}
	}

	private UUID uploadFile(String token, Path image) {
		String id = given().header("Authorization", "Bearer " + token).multiPart("file", image.toFile(), "image/jpeg")
				.when().post("/api/v1/photos").then().statusCode(201).extract().path("id");
		return UUID.fromString(id);
	}

	private Path createJpegImage(String prefix, int rgb) throws IOException {
		Path image = Files.createTempFile(prefix, ".jpg");
		BufferedImage img = new BufferedImage(100, 100, BufferedImage.TYPE_INT_RGB);
		var graphics = img.createGraphics();
		graphics.setColor(new java.awt.Color(rgb));
		graphics.fillRect(0, 0, 100, 100);
		graphics.dispose();
		ImageIO.write(img, "jpg", image.toFile());
		return image;
	}

	private String registerUserToken(String suffix) {
		String username = "fc-test-" + suffix + "-" + UUID.randomUUID().toString().substring(0, 8);
		return given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");
	}
}
