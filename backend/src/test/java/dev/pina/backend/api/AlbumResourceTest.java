package dev.pina.backend.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

import dev.pina.backend.TestAuthHelper;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AlbumResourceTest {

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
		String username = "album-test-" + suffix + "-" + UUID.randomUUID().toString().substring(0, 8);
		return given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");
	}

	private RequestSpecification authAs(String token) {
		return given().header("Authorization", "Bearer " + token);
	}

	@Test
	void createAlbumWithValidData() {
		TestAuthHelper.authenticated().contentType(ContentType.JSON)
				.body("{\"name\": \"Vacation 2026\", \"description\": \"Summer photos\"}").when().post("/api/v1/albums")
				.then().statusCode(201).body("id", notNullValue()).body("name", equalTo("Vacation 2026"))
				.body("personalLibraryId", notNullValue());
	}

	@Test
	void createAlbumWithBlankNameReturns400() {
		TestAuthHelper.authenticated().contentType(ContentType.JSON)
				.body("{\"name\": \"\", \"description\": \"No name\"}").when().post("/api/v1/albums").then()
				.statusCode(400);
	}

	@Test
	void createAlbumWithNullNameReturns400() {
		TestAuthHelper.authenticated().contentType(ContentType.JSON).body("{\"description\": \"Missing name field\"}")
				.when().post("/api/v1/albums").then().statusCode(400);
	}

	@Test
	void createAlbumWithTooLongNameReturns400() {
		String longName = "A".repeat(256);
		TestAuthHelper.authenticated().contentType(ContentType.JSON).body("{\"name\": \"" + longName + "\"}").when()
				.post("/api/v1/albums").then().statusCode(400);
	}

	@Test
	void listAlbumsReturnsArray() {
		TestAuthHelper.authenticated().when().get("/api/v1/albums").then().statusCode(200).body("$", notNullValue());
	}

	@Test
	void listPhotosForNonExistentAlbumReturns404() {
		TestAuthHelper.authenticated().when().get("/api/v1/albums/00000000-0000-0000-0000-000000000000/photos").then()
				.statusCode(404).body("error", equalTo("not_found"));
	}

	@Test
	void listPhotosWithNegativePageReturns400() {
		String albumId = TestAuthHelper.authenticated().contentType(ContentType.JSON)
				.body("{\"name\": \"Paging test\"}").when().post("/api/v1/albums").then().statusCode(201).extract()
				.path("id");

		TestAuthHelper.authenticated().when().get("/api/v1/albums/{id}/photos?page=-1", albumId).then().statusCode(400)
				.body("error", equalTo("bad_request"));
	}

	@Test
	void listPhotosWithNonPositiveSizeReturns400() {
		String albumId = TestAuthHelper.authenticated().contentType(ContentType.JSON)
				.body("{\"name\": \"Paging size test\"}").when().post("/api/v1/albums").then().statusCode(201).extract()
				.path("id");

		TestAuthHelper.authenticated().when().get("/api/v1/albums/{id}/photos?size=0", albumId).then().statusCode(400)
				.body("error", equalTo("bad_request"));
	}

	@Test
	void addPhotoToNonExistentAlbumReturns404() {
		TestAuthHelper.authenticated().when()
				.post("/api/v1/albums/00000000-0000-0000-0000-000000000000/photos/00000000-0000-0000-0000-000000000001")
				.then().statusCode(404).body("error", equalTo("not_found"));
	}

	@Test
	void addDuplicatePhotoToAlbumReturns200() throws IOException {
		Path testImage = createJpegImage("test-album-photo-duplicate", 100, 100, 0x336688);

		String photoId = TestAuthHelper.authenticated().multiPart("file", testImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");

		String albumId = TestAuthHelper.authenticated().contentType(ContentType.JSON)
				.body("{\"name\": \"Duplicate Test\"}").when().post("/api/v1/albums").then().statusCode(201).extract()
				.path("id");

		TestAuthHelper.authenticated().when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, photoId).then()
				.statusCode(201);
		TestAuthHelper.authenticated().when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, photoId).then()
				.statusCode(200);
	}

	@Test
	void createAlbumAndAddPhoto() throws IOException {
		Path testImage = createJpegImage("test-album-photo-add", 100, 100, 0x4477aa);

		String photoId = TestAuthHelper.authenticated().multiPart("file", testImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");

		String albumId = TestAuthHelper.authenticated().contentType(ContentType.JSON).body("{\"name\": \"Test Album\"}")
				.when().post("/api/v1/albums").then().statusCode(201).extract().path("id");

		TestAuthHelper.authenticated().when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, photoId).then()
				.statusCode(201);

		TestAuthHelper.authenticated().when().get("/api/v1/albums/{id}/photos", albumId).then().statusCode(200)
				.body("items", hasSize(1)).body("items[0].id", equalTo(photoId)).body("page", equalTo(0))
				.body("size", equalTo(50)).body("hasNext", equalTo(false)).body("totalItems", nullValue())
				.body("totalPages", nullValue());
	}

	@Test
	void updateAlbum() {
		String albumId = TestAuthHelper.authenticated().contentType(ContentType.JSON)
				.body("{\"name\": \"Original\", \"description\": \"Old\"}").when().post("/api/v1/albums").then()
				.statusCode(201).extract().path("id");

		TestAuthHelper.authenticated().contentType(ContentType.JSON)
				.body("{\"name\": \"Renamed\", \"description\": \"New description\"}").when()
				.put("/api/v1/albums/{id}", albumId).then().statusCode(200).body("name", equalTo("Renamed"))
				.body("description", equalTo("New description"));
	}

	@Test
	void updateNonExistentAlbumReturns404() {
		TestAuthHelper.authenticated().contentType(ContentType.JSON).body("{\"name\": \"Whatever\"}").when()
				.put("/api/v1/albums/00000000-0000-0000-0000-000000000000").then().statusCode(404)
				.body("error", equalTo("not_found"));
	}

	@Test
	void updateAlbumWithBlankNameReturns400() {
		String albumId = TestAuthHelper.authenticated().contentType(ContentType.JSON).body("{\"name\": \"Valid\"}")
				.when().post("/api/v1/albums").then().statusCode(201).extract().path("id");

		TestAuthHelper.authenticated().contentType(ContentType.JSON).body("{\"name\": \"\"}").when()
				.put("/api/v1/albums/{id}", albumId).then().statusCode(400);
	}

	@Test
	void removePhotoFromAlbum() throws IOException {
		Path testImage = createJpegImage("test-album-photo-remove", 90, 90, 0x884422);

		String photoId = TestAuthHelper.authenticated().multiPart("file", testImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");

		String albumId = TestAuthHelper.authenticated().contentType(ContentType.JSON)
				.body("{\"name\": \"Remove Test\"}").when().post("/api/v1/albums").then().statusCode(201).extract()
				.path("id");

		TestAuthHelper.authenticated().when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, photoId).then()
				.statusCode(201);

		TestAuthHelper.authenticated().when().delete("/api/v1/albums/{albumId}/photos/{photoId}", albumId, photoId)
				.then().statusCode(204);

		TestAuthHelper.authenticated().when().get("/api/v1/albums/{id}/photos", albumId).then().statusCode(200)
				.body("items", hasSize(0)).body("page", equalTo(0)).body("size", equalTo(50))
				.body("hasNext", equalTo(false));
	}

	@Test
	void listPhotosWithNeedsTotalReturnsPaginationMetadata() throws IOException {
		Path first = createJpegImage("album-needs-total-1", 100, 100, 0x114477);
		Path second = createJpegImage("album-needs-total-2", 100, 100, 0x771144);

		String firstPhotoId = TestAuthHelper.authenticated().multiPart("file", first.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
		String secondPhotoId = TestAuthHelper.authenticated().multiPart("file", second.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
		String albumId = TestAuthHelper.authenticated().contentType(ContentType.JSON)
				.body("{\"name\": \"Totals test\"}").when().post("/api/v1/albums").then().statusCode(201).extract()
				.path("id");

		TestAuthHelper.authenticated().when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, firstPhotoId)
				.then().statusCode(201);
		TestAuthHelper.authenticated().when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, secondPhotoId)
				.then().statusCode(201);

		TestAuthHelper.authenticated().when().get("/api/v1/albums/{id}/photos?size=1&needsTotal=true", albumId).then()
				.statusCode(200).body("items", hasSize(1)).body("page", equalTo(0)).body("size", equalTo(1))
				.body("hasNext", equalTo(true)).body("totalItems", equalTo(2)).body("totalPages", equalTo(2));
	}

	@Test
	void removeNonExistentPhotoFromAlbumReturns404() {
		TestAuthHelper.authenticated().when().delete(
				"/api/v1/albums/00000000-0000-0000-0000-000000000000/photos/00000000-0000-0000-0000-000000000001")
				.then().statusCode(404).body("error", equalTo("not_found"));
	}

	@Test
	void deleteAlbumReturns204() {
		String albumId = TestAuthHelper.authenticated().contentType(ContentType.JSON)
				.body("{\"name\": \"Delete Album\"}").when().post("/api/v1/albums").then().statusCode(201).extract()
				.path("id");

		TestAuthHelper.authenticated().when().delete("/api/v1/albums/{id}", albumId).then().statusCode(204);
	}

	@Test
	void deleteNonExistentAlbumReturns404() {
		TestAuthHelper.authenticated().when().delete("/api/v1/albums/00000000-0000-0000-0000-000000000000").then()
				.statusCode(404).body("error", equalTo("not_found"));
	}

	@Test
	void createAlbumWithExactly255CharNameSucceeds() {
		String name = "A".repeat(255);
		TestAuthHelper.authenticated().contentType(ContentType.JSON).body("{\"name\": \"" + name + "\"}").when()
				.post("/api/v1/albums").then().statusCode(201).body("name", equalTo(name));
	}

	@Test
	void createAlbumWithWhitespaceOnlyNameReturns400() {
		TestAuthHelper.authenticated().contentType(ContentType.JSON).body("{\"name\": \"   \"}").when()
				.post("/api/v1/albums").then().statusCode(400);
	}

	@Test
	void createAlbumWithDescriptionAt2000CharsSucceeds() {
		String desc = "D".repeat(2000);
		TestAuthHelper.authenticated().contentType(ContentType.JSON)
				.body("{\"name\": \"Boundary desc\", \"description\": \"" + desc + "\"}").when().post("/api/v1/albums")
				.then().statusCode(201);
	}

	@Test
	void createAlbumWithDescriptionOver2000CharsReturns400() {
		String desc = "D".repeat(2001);
		TestAuthHelper.authenticated().contentType(ContentType.JSON)
				.body("{\"name\": \"Too long desc\", \"description\": \"" + desc + "\"}").when().post("/api/v1/albums")
				.then().statusCode(400);
	}

	@Test
	void addNonExistentPhotoToExistingAlbumReturns404() {
		String albumId = TestAuthHelper.authenticated().contentType(ContentType.JSON)
				.body("{\"name\": \"Photo 404 test\"}").when().post("/api/v1/albums").then().statusCode(201).extract()
				.path("id");

		TestAuthHelper.authenticated().when()
				.post("/api/v1/albums/{albumId}/photos/00000000-0000-0000-0000-000000000099", albumId).then()
				.statusCode(404).body("error", equalTo("not_found"));
	}

	@Test
	void addOtherUsersPhotoToAlbumReturns404() throws IOException {
		String ownerToken = registerUserToken("photo-owner");
		String albumOwnerToken = registerUserToken("album-owner");
		Path testImage = createJpegImage("test-album-foreign-photo", 100, 100, 0x778844);

		String photoId = authAs(ownerToken).multiPart("file", testImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
		String albumId = authAs(albumOwnerToken).contentType(ContentType.JSON).body("{\"name\": \"Private Album\"}")
				.when().post("/api/v1/albums").then().statusCode(201).extract().path("id");

		authAs(albumOwnerToken).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, photoId).then()
				.statusCode(404).body("error", equalTo("not_found"));
	}

	@Test
	void deleteAlbumWithPhotosRemovesOnlyReferences() throws IOException {
		Path testImage = createJpegImage("test-album-cascade", 100, 100, 0x559944);

		String photoId = TestAuthHelper.authenticated().multiPart("file", testImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");

		String albumId = TestAuthHelper.authenticated().contentType(ContentType.JSON)
				.body("{\"name\": \"Cascade test\"}").when().post("/api/v1/albums").then().statusCode(201).extract()
				.path("id");

		TestAuthHelper.authenticated().when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, photoId).then()
				.statusCode(201);

		TestAuthHelper.authenticated().when().delete("/api/v1/albums/{id}", albumId).then().statusCode(204);

		TestAuthHelper.authenticated().when().get("/api/v1/photos/{id}", photoId).then().statusCode(200);

		TestAuthHelper.authenticated().when().delete("/api/v1/photos/{id}", photoId).then().statusCode(204);
	}
}
