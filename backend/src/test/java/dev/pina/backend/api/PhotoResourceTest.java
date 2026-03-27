package dev.pina.backend.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;

import io.quarkus.test.junit.QuarkusTest;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
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

	@Test
	void uploadAndRetrievePhoto() throws IOException {
		Path testImage = createJpegImage("test-photo-main", 100, 100, 0x336699);

		// Upload
		String photoId = given().multiPart("file", testImage.toFile(), "image/jpeg").when().post("/api/v1/photos")
				.then().statusCode(201).body("id", notNullValue()).body("mimeType", equalTo("image/jpeg"))
				.body("personalLibraryId", notNullValue()).body("variants", hasSize(5)).extract().path("id");

		// Get metadata
		given().when().get("/api/v1/photos/{id}", photoId).then().statusCode(200).body("id", equalTo(photoId));

		// Get compressed file — format must match configured compression format (jpeg)
		given().when().get("/api/v1/photos/{id}/file?variant=COMPRESSED", photoId).then().statusCode(200)
				.contentType(equalTo("image/jpeg"));

		// Get original
		given().when().get("/api/v1/photos/{id}/file?variant=ORIGINAL", photoId).then().statusCode(200)
				.contentType(equalTo("image/jpeg"));

		// Get thumbnail
		given().when().get("/api/v1/photos/{id}/file?variant=THUMB_SM", photoId).then().statusCode(200)
				.contentType(equalTo("image/jpeg"));

		// Delete
		given().when().delete("/api/v1/photos/{id}", photoId).then().statusCode(204);

		// Verify deleted
		given().when().get("/api/v1/photos/{id}", photoId).then().statusCode(404);
	}

	@Test
	void listPhotosReturnsUploadedPhotosWithPagination() throws IOException {
		Path first = createJpegImage("test-photo-list-1", 110, 90, 0x336699);
		Path second = createJpegImage("test-photo-list-2", 120, 95, 0x996633);

		String firstId = given().multiPart("file", first.toFile(), "image/jpeg").when().post("/api/v1/photos").then()
				.statusCode(201).extract().path("id");
		String secondId = given().multiPart("file", second.toFile(), "image/jpeg").when().post("/api/v1/photos").then()
				.statusCode(201).extract().path("id");

		given().when().get("/api/v1/photos?size=100&needsTotal=true").then().statusCode(200)
				.body("items.id", hasItems(firstId, secondId)).body("page", equalTo(0)).body("size", equalTo(100))
				.body("hasNext", equalTo(false)).body("totalItems", notNullValue()).body("totalPages", notNullValue());
	}

	@Test
	void listPhotosWithNeedsTotalReturnsPaginationMetadata() throws IOException {
		Path first = createJpegImage("test-photo-totals-1", 130, 100, 0x114477);
		Path second = createJpegImage("test-photo-totals-2", 135, 105, 0x771144);

		given().multiPart("file", first.toFile(), "image/jpeg").when().post("/api/v1/photos").then().statusCode(201);
		given().multiPart("file", second.toFile(), "image/jpeg").when().post("/api/v1/photos").then().statusCode(201);

		given().when().get("/api/v1/photos?size=1&needsTotal=true").then().statusCode(200).body("items", hasSize(1))
				.body("page", equalTo(0)).body("size", equalTo(1)).body("hasNext", equalTo(true))
				.body("totalItems", notNullValue()).body("totalPages", notNullValue());
	}

	@Test
	void listPhotosWithNegativePageReturns400() {
		given().when().get("/api/v1/photos?page=-1").then().statusCode(400).body("error", equalTo("bad_request"));
	}

	@Test
	void listPhotosWithNonPositiveSizeReturns400() {
		given().when().get("/api/v1/photos?size=0").then().statusCode(400).body("error", equalTo("bad_request"));
	}

	@Test
	void getNonExistentPhoto() {
		given().when().get("/api/v1/photos/00000000-0000-0000-0000-000000000000").then().statusCode(404).body("error",
				equalTo("not_found"));
	}

	@Test
	void uploadUnsupportedMimeTypeReturns415() throws IOException {
		Path testImage = createJpegImage("test-photo-invalid-mime", 90, 90, 0x663399);
		given().multiPart("file", testImage.toFile(), "application/pdf").when().post("/api/v1/photos").then()
				.statusCode(415).body("error", equalTo("unsupported_media_type"));
	}

	@Test
	void uploadFutureFormatMimeTypeReturns415InPhase1() throws IOException {
		Path testImage = createJpegImage("test-photo-webp-mime", 95, 95, 0x336633);
		given().multiPart("file", testImage.toFile(), "image/webp").when().post("/api/v1/photos").then().statusCode(415)
				.body("error", equalTo("unsupported_media_type"));
	}

	@Test
	void uploadMalformedImageReturns400() throws IOException {
		Path invalidImage = Files.createTempFile("test-photo-malformed", ".jpg");
		Files.writeString(invalidImage, "not a real image payload");

		given().multiPart("file", invalidImage.toFile(), "image/jpeg").when().post("/api/v1/photos").then()
				.statusCode(400);
	}

	@Test
	void uploadDuplicateReturnsSamePhoto() throws IOException {
		Path testImage = createJpegImage("test-photo-duplicate", 120, 80, 0x993333);

		// First upload
		String firstId = given().multiPart("file", testImage.toFile(), "image/jpeg").when().post("/api/v1/photos")
				.then().statusCode(201).extract().path("id");

		// Second upload of same file — should deduplicate
		String secondId = given().multiPart("file", testImage.toFile(), "image/jpeg").when().post("/api/v1/photos")
				.then().statusCode(201).extract().path("id");

		assertEquals(firstId, secondId);

		// Cleanup
		given().when().delete("/api/v1/photos/{id}", firstId).then().statusCode(204);
	}

	@Test
	void deleteNonExistentPhotoReturns404() {
		given().when().delete("/api/v1/photos/00000000-0000-0000-0000-000000000000").then().statusCode(404)
				.body("error", equalTo("not_found"));
	}

	@Test
	void deleteReferencedPhotoReturns409() throws IOException {
		Path testImage = createJpegImage("test-photo-ref", 140, 110, 0x225522);

		String photoId = given().multiPart("file", testImage.toFile(), "image/jpeg").when().post("/api/v1/photos")
				.then().statusCode(201).extract().path("id");

		String albumId = given().contentType(io.restassured.http.ContentType.JSON).body("{\"name\": \"Ref test\"}")
				.when().post("/api/v1/albums").then().statusCode(201).extract().path("id");

		given().when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, photoId).then().statusCode(201);

		given().when().delete("/api/v1/photos/{id}", photoId).then().statusCode(409).body("error", equalTo("conflict"));
	}

	@Test
	void getFileForNonExistentPhotoReturns404() {
		given().when().get("/api/v1/photos/00000000-0000-0000-0000-000000000000/file").then().statusCode(404)
				.body("error", equalTo("not_found"));
	}

	@Test
	void getFileWithInvalidVariantReturns400() throws IOException {
		Path testImage = createJpegImage("test-photo-invalid-variant", 100, 100, 0x224488);
		String photoId = given().multiPart("file", testImage.toFile(), "image/jpeg").when().post("/api/v1/photos")
				.then().statusCode(201).extract().path("id");

		given().when().get("/api/v1/photos/{id}/file?variant=wat", photoId).then().statusCode(400).body("error",
				equalTo("bad_request"));
	}

	@Test
	void uploadPngImage() throws IOException {
		Path pngFile = Files.createTempFile("test-photo", ".png");
		BufferedImage img = new BufferedImage(80, 60, BufferedImage.TYPE_INT_RGB);
		var g = img.createGraphics();
		g.fillRect(0, 0, 80, 60);
		g.dispose();
		ImageIO.write(img, "png", pngFile.toFile());

		String photoId = given().multiPart("file", pngFile.toFile(), "image/png").when().post("/api/v1/photos").then()
				.statusCode(201).body("mimeType", equalTo("image/png")).extract().path("id");

		// Cleanup
		given().when().delete("/api/v1/photos/{id}", photoId).then().statusCode(204);
	}
}
