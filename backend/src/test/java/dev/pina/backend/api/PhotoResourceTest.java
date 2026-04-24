package dev.pina.backend.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.pina.backend.TestAuthHelper;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

@QuarkusTest
class PhotoResourceTest {

	private Path createJpegImage(String prefix, int width, int height, int rgb) throws IOException {
		Path image = Files.createTempFile(prefix, ".jpg");
		BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
		var g = img.createGraphics();
		g.setColor(new java.awt.Color(rgb));
		g.fillRect(0, 0, width, height);
		g.dispose();
		ImageIO.write(img, "jpg", image.toFile());
		return image;
	}

	private String registerUserToken(String suffix) {
		String username = "photo-test-" + suffix + "-" + UUID.randomUUID().toString().substring(0, 8);
		return given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");
	}

	@Test
	void uploadAndRetrievePhoto() throws IOException {
		Path testImage = createJpegImage("test-photo-main", 100, 100, 0x336699);

		String photoId = TestAuthHelper.authenticated().multiPart("file", testImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).body("id", notNullValue())
				.body("mimeType", equalTo("image/jpeg")).body("personalLibraryId", notNullValue())
				.body("variants", hasSize(6)).extract().path("id");

		TestAuthHelper.authenticated().when().get("/api/v1/photos/{id}", photoId).then().statusCode(200).body("id",
				equalTo(photoId));

		TestAuthHelper.authenticated().when().get("/api/v1/photos/{id}/file?variant=COMPRESSED", photoId).then()
				.statusCode(200).contentType(equalTo("image/jpeg"));

		TestAuthHelper.authenticated().when().get("/api/v1/photos/{id}/file?variant=ORIGINAL", photoId).then()
				.statusCode(200).contentType(equalTo("image/jpeg"));

		TestAuthHelper.authenticated().when().get("/api/v1/photos/{id}/file?variant=THUMB_XS", photoId).then()
				.statusCode(200).contentType(equalTo("image/jpeg"));

		TestAuthHelper.authenticated().when().get("/api/v1/photos/{id}/file?variant=THUMB_SM", photoId).then()
				.statusCode(200).contentType(equalTo("image/jpeg"));

		TestAuthHelper.authenticated().when().delete("/api/v1/photos/{id}", photoId).then().statusCode(204);

		TestAuthHelper.authenticated().when().get("/api/v1/photos/{id}", photoId).then().statusCode(404);
	}

	@Test
	void listPhotosReturnsUploadedPhotosWithPagination() throws IOException {
		Path first = createJpegImage("test-photo-list-1", 110, 90, 0x336699);
		Path second = createJpegImage("test-photo-list-2", 120, 95, 0x996633);

		String firstId = TestAuthHelper.authenticated().multiPart("file", first.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
		String secondId = TestAuthHelper.authenticated().multiPart("file", second.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");

		TestAuthHelper.authenticated().when().get("/api/v1/photos?size=100&needsTotal=true").then().statusCode(200)
				.body("items.id", hasItems(firstId, secondId)).body("page", equalTo(0)).body("size", equalTo(100))
				.body("hasNext", equalTo(false)).body("totalItems", notNullValue()).body("totalPages", notNullValue());
	}

	@Test
	void listPhotosWithNeedsTotalReturnsPaginationMetadata() throws IOException {
		Path first = createJpegImage("test-photo-totals-1", 130, 100, 0x114477);
		Path second = createJpegImage("test-photo-totals-2", 135, 105, 0x771144);

		TestAuthHelper.authenticated().multiPart("file", first.toFile(), "image/jpeg").when().post("/api/v1/photos")
				.then().statusCode(201);
		TestAuthHelper.authenticated().multiPart("file", second.toFile(), "image/jpeg").when().post("/api/v1/photos")
				.then().statusCode(201);

		TestAuthHelper.authenticated().when().get("/api/v1/photos?size=1&needsTotal=true").then().statusCode(200)
				.body("items", hasSize(1)).body("page", equalTo(0)).body("size", equalTo(1))
				.body("hasNext", equalTo(true)).body("totalItems", notNullValue()).body("totalPages", notNullValue());
	}

	@Test
	void listPhotosWithNegativePageReturns400() {
		TestAuthHelper.authenticated().when().get("/api/v1/photos?page=-1").then().statusCode(400).body("error",
				equalTo("bad_request"));
	}

	@Test
	void listPhotosWithNonPositiveSizeReturns400() {
		TestAuthHelper.authenticated().when().get("/api/v1/photos?size=0").then().statusCode(400).body("error",
				equalTo("bad_request"));
	}

	@Test
	void getNonExistentPhoto() {
		TestAuthHelper.authenticated().when().get("/api/v1/photos/00000000-0000-0000-0000-000000000000").then()
				.statusCode(404).body("error", equalTo("not_found"));
	}

	@Test
	void uploadUnsupportedMimeTypeReturns415() throws IOException {
		Path testImage = createJpegImage("test-photo-invalid-mime", 90, 90, 0x663399);
		TestAuthHelper.authenticated().multiPart("file", testImage.toFile(), "application/pdf").when()
				.post("/api/v1/photos").then().statusCode(415).body("error", equalTo("unsupported_media_type"));
	}

	@Test
	void uploadFutureFormatMimeTypeReturns415InPhase1() throws IOException {
		Path testImage = createJpegImage("test-photo-webp-mime", 95, 95, 0x336633);
		TestAuthHelper.authenticated().multiPart("file", testImage.toFile(), "image/webp").when().post("/api/v1/photos")
				.then().statusCode(415).body("error", equalTo("unsupported_media_type"));
	}

	@Test
	void uploadMalformedImageReturns400() throws IOException {
		Path invalidImage = Files.createTempFile("test-photo-malformed", ".jpg");
		Files.writeString(invalidImage, "not a real image payload");

		TestAuthHelper.authenticated().multiPart("file", invalidImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(400);
	}

	@Test
	void uploadDuplicateReturnsSamePhoto() throws IOException {
		Path testImage = createJpegImage("test-photo-duplicate", 120, 80, 0x993333);

		String firstId = TestAuthHelper.authenticated().multiPart("file", testImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");

		String secondId = TestAuthHelper.authenticated().multiPart("file", testImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");

		assertEquals(firstId, secondId);

		TestAuthHelper.authenticated().when().delete("/api/v1/photos/{id}", firstId).then().statusCode(204);
	}

	@Test
	void uploadDuplicateOwnedByDifferentUserCreatesSeparatePhoto() throws IOException {
		Path testImage = createJpegImage("test-photo-cross-user-duplicate", 120, 80, 0x334499);

		String firstId = TestAuthHelper.authenticated().multiPart("file", testImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");

		String otherToken = registerUserToken("cross-user");
		String secondId = given().header("Authorization", "Bearer " + otherToken)
				.multiPart("file", testImage.toFile(), "image/jpeg").when().post("/api/v1/photos").then()
				.statusCode(201).extract().path("id");

		assertTrue(!firstId.equals(secondId));
	}

	@Test
	void deleteNonExistentPhotoReturns404() {
		TestAuthHelper.authenticated().when().delete("/api/v1/photos/00000000-0000-0000-0000-000000000000").then()
				.statusCode(404).body("error", equalTo("not_found"));
	}

	@Test
	void deleteReferencedPhotoReturns409() throws IOException {
		Path testImage = createJpegImage("test-photo-ref", 140, 110, 0x225522);

		String photoId = TestAuthHelper.authenticated().multiPart("file", testImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");

		String albumId = TestAuthHelper.authenticated().contentType(io.restassured.http.ContentType.JSON)
				.body("{\"name\": \"Ref test\"}").when().post("/api/v1/albums").then().statusCode(201).extract()
				.path("id");

		TestAuthHelper.authenticated().when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, photoId).then()
				.statusCode(201);

		TestAuthHelper.authenticated().when().delete("/api/v1/photos/{id}", photoId).then().statusCode(409)
				.body("error", equalTo("conflict"));
	}

	@Test
	void getFileForNonExistentPhotoReturns404() {
		TestAuthHelper.authenticated().when().get("/api/v1/photos/00000000-0000-0000-0000-000000000000/file").then()
				.statusCode(404).body("error", equalTo("not_found"));
	}

	@Test
	void getFileWithInvalidVariantReturns400() throws IOException {
		Path testImage = createJpegImage("test-photo-invalid-variant", 100, 100, 0x224488);
		String photoId = TestAuthHelper.authenticated().multiPart("file", testImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");

		TestAuthHelper.authenticated().when().get("/api/v1/photos/{id}/file?variant=wat", photoId).then()
				.statusCode(400).body("error", equalTo("bad_request"));
	}

	@Test
	void uploadPngImage() throws IOException {
		Path pngFile = Files.createTempFile("test-photo", ".png");
		BufferedImage img = new BufferedImage(80, 60, BufferedImage.TYPE_INT_RGB);
		var g = img.createGraphics();
		g.fillRect(0, 0, 80, 60);
		g.dispose();
		ImageIO.write(img, "png", pngFile.toFile());

		String photoId = TestAuthHelper.authenticated().multiPart("file", pngFile.toFile(), "image/png").when()
				.post("/api/v1/photos").then().statusCode(201).body("mimeType", equalTo("image/png")).extract()
				.path("id");

		TestAuthHelper.authenticated().when().delete("/api/v1/photos/{id}", photoId).then().statusCode(204);
	}
}
