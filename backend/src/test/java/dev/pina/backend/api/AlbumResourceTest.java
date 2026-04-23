package dev.pina.backend.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;

import dev.pina.backend.TestAuthHelper;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
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
				.body("personalLibraryId", notNullValue()).body("coverPhotoId", nullValue())
				.body("coverVariants", hasSize(0)).body("photoCount", equalTo(0)).body("mediaRangeStart", nullValue())
				.body("mediaRangeEnd", nullValue()).body("latestPhotoAddedAt", nullValue());
	}

	@Test
	void listAlbumWithPhotosReturnsSummaryFields() throws IOException {
		String token = registerUserToken("summary-fields");
		Path testImage = createJpegImage("album-summary-cover", 100, 100, 0x2277aa);

		String photoId = authAs(token).multiPart("file", testImage.toFile(), "image/jpeg").when().post("/api/v1/photos")
				.then().statusCode(201).extract().path("id");

		String albumId = authAs(token).contentType(ContentType.JSON).body("{\"name\": \"Summary album\"}").when()
				.post("/api/v1/albums").then().statusCode(201).extract().path("id");

		authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, photoId).then().statusCode(201);

		authAs(token).when().get("/api/v1/albums").then().statusCode(200).body("items", hasSize(1))
				.body("items[0].id", equalTo(albumId)).body("items[0].coverPhotoId", equalTo(photoId))
				.body("items[0].coverVariants", hasSize(greaterThan(0))).body("items[0].photoCount", equalTo(1))
				.body("items[0].mediaRangeStart", notNullValue()).body("items[0].mediaRangeEnd", notNullValue())
				.body("items[0].latestPhotoAddedAt", notNullValue());
	}

	@Test
	void listAlbumWithMultiplePhotosReturnsCorrectRangeAndCount() throws IOException {
		String token = registerUserToken("multi-photo");
		Path firstImage = createJpegImage("album-multi-1", 100, 100, 0x112233);
		Path secondImage = createJpegImage("album-multi-2", 100, 100, 0x445566);
		Path thirdImage = createJpegImage("album-multi-3", 100, 100, 0x778899);

		String firstPhotoId = authAs(token).multiPart("file", firstImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
		String secondPhotoId = authAs(token).multiPart("file", secondImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
		String thirdPhotoId = authAs(token).multiPart("file", thirdImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");

		String albumId = authAs(token).contentType(ContentType.JSON).body("{\"name\": \"Range album\"}").when()
				.post("/api/v1/albums").then().statusCode(201).extract().path("id");

		authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, firstPhotoId).then()
				.statusCode(201);
		authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, secondPhotoId).then()
				.statusCode(201);
		authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, thirdPhotoId).then()
				.statusCode(201);

		authAs(token).when().get("/api/v1/albums").then().statusCode(200).body("items", hasSize(1))
				.body("items[0].photoCount", equalTo(3)).body("items[0].coverPhotoId", equalTo(thirdPhotoId))
				.body("items[0].mediaRangeStart", notNullValue()).body("items[0].mediaRangeEnd", notNullValue());
	}

	@Test
	void removingCoverPhotoFromAlbumFallsBackToAutoCover() throws IOException {
		String token = registerUserToken("cover-fallback");
		Path firstImage = createJpegImage("album-fallback-1", 100, 100, 0xaabbcc);
		Path secondImage = createJpegImage("album-fallback-2", 100, 100, 0xddeeff);

		String firstPhotoId = authAs(token).multiPart("file", firstImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
		String secondPhotoId = authAs(token).multiPart("file", secondImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");

		String albumId = authAs(token).contentType(ContentType.JSON).body("{\"name\": \"Fallback album\"}").when()
				.post("/api/v1/albums").then().statusCode(201).extract().path("id");

		authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, firstPhotoId).then()
				.statusCode(201);
		authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, secondPhotoId).then()
				.statusCode(201);

		authAs(token).when().get("/api/v1/albums").then().statusCode(200)
				.body("items[0].coverPhotoId", equalTo(secondPhotoId)).body("items[0].photoCount", equalTo(2));

		authAs(token).when().delete("/api/v1/albums/{albumId}/photos/{photoId}", albumId, secondPhotoId).then()
				.statusCode(204);

		authAs(token).when().get("/api/v1/albums").then().statusCode(200)
				.body("items[0].coverPhotoId", equalTo(firstPhotoId)).body("items[0].photoCount", equalTo(1));
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
	void listAlbumsReturnsPaginatedResult() {
		TestAuthHelper.authenticated().when().get("/api/v1/albums").then().statusCode(200).body("items", notNullValue())
				.body("page", equalTo(0)).body("size", equalTo(50)).body("hasNext", equalTo(false));
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

	@Test
	void setCoverAssignsExplicitCover() throws IOException {
		String token = registerUserToken("set-cover");
		Path first = createJpegImage("album-set-cover-1", 100, 100, 0x112244);
		Path second = createJpegImage("album-set-cover-2", 100, 100, 0x884422);

		String firstPhotoId = authAs(token).multiPart("file", first.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
		String secondPhotoId = authAs(token).multiPart("file", second.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
		String albumId = authAs(token).contentType(ContentType.JSON).body("{\"name\": \"Set cover album\"}").when()
				.post("/api/v1/albums").then().statusCode(201).extract().path("id");

		authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, firstPhotoId).then()
				.statusCode(201);
		authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, secondPhotoId).then()
				.statusCode(201);

		authAs(token).contentType(ContentType.JSON).body("{\"photoId\": \"" + firstPhotoId + "\"}").when()
				.put("/api/v1/albums/{id}/cover", albumId).then().statusCode(200)
				.body("coverPhotoId", equalTo(firstPhotoId));

		authAs(token).when().get("/api/v1/albums").then().statusCode(200).body("items[0].coverPhotoId",
				equalTo(firstPhotoId));
	}

	@Test
	void clearCoverFallsBackToAutoResolution() throws IOException {
		String token = registerUserToken("clear-cover");
		Path first = createJpegImage("album-clear-cover-1", 100, 100, 0x224466);
		Path second = createJpegImage("album-clear-cover-2", 100, 100, 0x668844);

		String firstPhotoId = authAs(token).multiPart("file", first.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
		String secondPhotoId = authAs(token).multiPart("file", second.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
		String albumId = authAs(token).contentType(ContentType.JSON).body("{\"name\": \"Clear cover album\"}").when()
				.post("/api/v1/albums").then().statusCode(201).extract().path("id");

		authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, firstPhotoId).then()
				.statusCode(201);
		authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, secondPhotoId).then()
				.statusCode(201);

		authAs(token).contentType(ContentType.JSON).body("{\"photoId\": \"" + firstPhotoId + "\"}").when()
				.put("/api/v1/albums/{id}/cover", albumId).then().statusCode(200);

		authAs(token).when().delete("/api/v1/albums/{id}/cover", albumId).then().statusCode(200).body("coverPhotoId",
				equalTo(secondPhotoId));
	}

	@Test
	void setCoverWithPhotoNotInAlbumReturns404() throws IOException {
		String token = registerUserToken("cover-not-member");
		Path inAlbum = createJpegImage("album-cover-member", 100, 100, 0x556677);
		Path orphan = createJpegImage("album-cover-orphan", 100, 100, 0x889900);

		String memberPhotoId = authAs(token).multiPart("file", inAlbum.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
		String orphanPhotoId = authAs(token).multiPart("file", orphan.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
		String albumId = authAs(token).contentType(ContentType.JSON).body("{\"name\": \"Member album\"}").when()
				.post("/api/v1/albums").then().statusCode(201).extract().path("id");

		authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, memberPhotoId).then()
				.statusCode(201);

		authAs(token).contentType(ContentType.JSON).body("{\"photoId\": \"" + orphanPhotoId + "\"}").when()
				.put("/api/v1/albums/{id}/cover", albumId).then().statusCode(404).body("error", equalTo("not_found"));
	}

	@Test
	void removingExplicitCoverPhotoFromAlbumClearsCover() throws IOException {
		String token = registerUserToken("cover-cleanup-membership");
		Path first = createJpegImage("album-cleanup-1", 100, 100, 0x778899);
		Path second = createJpegImage("album-cleanup-2", 100, 100, 0x112233);

		String firstPhotoId = authAs(token).multiPart("file", first.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
		String secondPhotoId = authAs(token).multiPart("file", second.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
		String albumId = authAs(token).contentType(ContentType.JSON).body("{\"name\": \"Cleanup album\"}").when()
				.post("/api/v1/albums").then().statusCode(201).extract().path("id");

		authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, firstPhotoId).then()
				.statusCode(201);
		authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, secondPhotoId).then()
				.statusCode(201);

		authAs(token).contentType(ContentType.JSON).body("{\"photoId\": \"" + firstPhotoId + "\"}").when()
				.put("/api/v1/albums/{id}/cover", albumId).then().statusCode(200);

		authAs(token).when().delete("/api/v1/albums/{albumId}/photos/{photoId}", albumId, firstPhotoId).then()
				.statusCode(204);

		authAs(token).when().get("/api/v1/albums").then().statusCode(200).body("items[0].coverPhotoId",
				equalTo(secondPhotoId));
	}

	@Test
	void deletingExplicitCoverPhotoClearsCoverViaForeignKey() throws IOException {
		String token = registerUserToken("cover-cleanup-fk");
		Path first = createJpegImage("album-fk-cleanup-1", 100, 100, 0xaabbcc);
		Path second = createJpegImage("album-fk-cleanup-2", 100, 100, 0xccddee);

		String firstPhotoId = authAs(token).multiPart("file", first.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
		String secondPhotoId = authAs(token).multiPart("file", second.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
		String albumId = authAs(token).contentType(ContentType.JSON).body("{\"name\": \"FK cleanup album\"}").when()
				.post("/api/v1/albums").then().statusCode(201).extract().path("id");

		authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, firstPhotoId).then()
				.statusCode(201);
		authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, secondPhotoId).then()
				.statusCode(201);

		authAs(token).contentType(ContentType.JSON).body("{\"photoId\": \"" + firstPhotoId + "\"}").when()
				.put("/api/v1/albums/{id}/cover", albumId).then().statusCode(200);

		authAs(token).when().delete("/api/v1/albums/{albumId}/photos/{photoId}", albumId, firstPhotoId).then()
				.statusCode(204);
		authAs(token).when().delete("/api/v1/photos/{id}", firstPhotoId).then().statusCode(204);

		authAs(token).when().get("/api/v1/albums").then().statusCode(200)
				.body("items[0].coverPhotoId", equalTo(secondPhotoId)).body("items[0].photoCount", equalTo(1));
	}

	@Test
	void setCoverByNonOwnerReturns404() throws IOException {
		String ownerToken = registerUserToken("cover-owner");
		String intruderToken = registerUserToken("cover-intruder");
		Path image = createJpegImage("album-non-owner", 100, 100, 0xdeadbe);

		String photoId = authAs(ownerToken).multiPart("file", image.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
		String albumId = authAs(ownerToken).contentType(ContentType.JSON).body("{\"name\": \"Private\"}").when()
				.post("/api/v1/albums").then().statusCode(201).extract().path("id");

		authAs(ownerToken).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, photoId).then()
				.statusCode(201);

		authAs(intruderToken).contentType(ContentType.JSON).body("{\"photoId\": \"" + photoId + "\"}").when()
				.put("/api/v1/albums/{id}/cover", albumId).then().statusCode(404).body("error", equalTo("not_found"));

		authAs(intruderToken).when().delete("/api/v1/albums/{id}/cover", albumId).then().statusCode(404).body("error",
				equalTo("not_found"));
	}

	@Test
	void listAlbumsSortByNameAscOrderedAlphabetically() throws IOException {
		String token = registerUserToken("sort-name");
		String cId = createAlbum(token, "Charlie");
		String aId = createAlbum(token, "Alpha");
		String bId = createAlbum(token, "Bravo");

		authAs(token).queryParam("sort", "name").queryParam("direction", "asc").when().get("/api/v1/albums").then()
				.statusCode(200).body("items", hasSize(3)).body("items[0].id", equalTo(aId))
				.body("items[1].id", equalTo(bId)).body("items[2].id", equalTo(cId));

		authAs(token).queryParam("sort", "name").queryParam("direction", "desc").when().get("/api/v1/albums").then()
				.statusCode(200).body("items[0].id", equalTo(cId)).body("items[1].id", equalTo(bId))
				.body("items[2].id", equalTo(aId));

		authAs(token).queryParam("sort", "name").when().get("/api/v1/albums").then().statusCode(200).body("items[0].id",
				equalTo(aId));
	}

	@Test
	void listAlbumsSortByItemCountOrdersByPhotoCount() throws IOException {
		String token = registerUserToken("sort-count");
		String oneId = createAlbum(token, "One");
		String threeId = createAlbum(token, "Three");
		String twoId = createAlbum(token, "Two");

		addUniquePhotos(token, oneId, 1);
		addUniquePhotos(token, threeId, 3);
		addUniquePhotos(token, twoId, 2);

		authAs(token).queryParam("sort", "itemCount").queryParam("direction", "desc").when().get("/api/v1/albums")
				.then().statusCode(200).body("items[0].id", equalTo(threeId)).body("items[1].id", equalTo(twoId))
				.body("items[2].id", equalTo(oneId));

		authAs(token).queryParam("sort", "itemCount").queryParam("direction", "asc").when().get("/api/v1/albums").then()
				.statusCode(200).body("items[0].id", equalTo(oneId)).body("items[1].id", equalTo(twoId))
				.body("items[2].id", equalTo(threeId));
	}

	@Test
	void listAlbumsSortByCreatedAtDescIsDefault() throws IOException {
		String token = registerUserToken("sort-default");
		String firstId = createAlbum(token, "First");
		String secondId = createAlbum(token, "Second");
		String thirdId = createAlbum(token, "Third");

		authAs(token).when().get("/api/v1/albums").then().statusCode(200).body("items[0].id", equalTo(thirdId))
				.body("items[1].id", equalTo(secondId)).body("items[2].id", equalTo(firstId));

		authAs(token).queryParam("sort", "createdAt").queryParam("direction", "asc").when().get("/api/v1/albums").then()
				.statusCode(200).body("items[0].id", equalTo(firstId)).body("items[1].id", equalTo(secondId))
				.body("items[2].id", equalTo(thirdId));
	}

	@Test
	void listAlbumsSortByUpdatedAtReflectsLastEdit() throws IOException {
		String token = registerUserToken("sort-updated");
		String firstId = createAlbum(token, "First");
		String secondId = createAlbum(token, "Second");
		String thirdId = createAlbum(token, "Third");

		authAs(token).contentType(ContentType.JSON).body("{\"name\": \"First edited\"}").when()
				.put("/api/v1/albums/{id}", firstId).then().statusCode(200);

		authAs(token).queryParam("sort", "updatedAt").queryParam("direction", "desc").when().get("/api/v1/albums")
				.then().statusCode(200).body("items[0].id", equalTo(firstId)).body("items[1].id", equalTo(thirdId))
				.body("items[2].id", equalTo(secondId));
	}

	@Test
	void listAlbumsSortByNewestPhotoPlacesEmptyAlbumsByNullPolicy() throws IOException {
		String token = registerUserToken("sort-newest");
		String emptyId = createAlbum(token, "Empty");
		String olderId = createAlbum(token, "Older");
		String newerId = createAlbum(token, "Newer");

		String olderPhoto = uploadPhoto(token, "newest-older", 0x112233);
		authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", olderId, olderPhoto).then()
				.statusCode(201);
		String newerPhoto = uploadPhoto(token, "newest-newer", 0x445566);
		authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", newerId, newerPhoto).then()
				.statusCode(201);

		authAs(token).queryParam("sort", "newestPhoto").queryParam("direction", "desc").when().get("/api/v1/albums")
				.then().statusCode(200).body("items[0].id", equalTo(newerId)).body("items[1].id", equalTo(olderId))
				.body("items[2].id", equalTo(emptyId));

		authAs(token).queryParam("sort", "newestPhoto").queryParam("direction", "asc").when().get("/api/v1/albums")
				.then().statusCode(200).body("items[0].id", equalTo(emptyId)).body("items[1].id", equalTo(olderId))
				.body("items[2].id", equalTo(newerId));
	}

	@Test
	void listAlbumsInvalidSortReturns400() {
		TestAuthHelper.authenticated().queryParam("sort", "bogus").when().get("/api/v1/albums").then().statusCode(400)
				.body("error", equalTo("bad_request"));
	}

	@Test
	void listAlbumsInvalidDirectionReturns400() {
		TestAuthHelper.authenticated().queryParam("direction", "sideways").when().get("/api/v1/albums").then()
				.statusCode(400).body("error", equalTo("bad_request"));
	}

	@Test
	void listAlbumsPaginationStableUnderTies() throws IOException {
		String token = registerUserToken("sort-pagination");
		String firstId = createAlbum(token, "Same");
		String secondId = createAlbum(token, "Same");
		String thirdId = createAlbum(token, "Same");

		String firstPageFirst = authAs(token).queryParam("sort", "name").queryParam("direction", "asc")
				.queryParam("size", "2").queryParam("page", "0").when().get("/api/v1/albums").then().statusCode(200)
				.body("items", hasSize(2)).extract().path("items[0].id");
		String firstPageSecond = authAs(token).queryParam("sort", "name").queryParam("direction", "asc")
				.queryParam("size", "2").queryParam("page", "0").when().get("/api/v1/albums").then().extract()
				.path("items[1].id");
		String secondPageFirst = authAs(token).queryParam("sort", "name").queryParam("direction", "asc")
				.queryParam("size", "2").queryParam("page", "1").when().get("/api/v1/albums").then().statusCode(200)
				.body("items", hasSize(1)).extract().path("items[0].id");

		java.util.Set<String> collected = new java.util.HashSet<>();
		collected.add(firstPageFirst);
		collected.add(firstPageSecond);
		collected.add(secondPageFirst);
		org.junit.jupiter.api.Assertions.assertEquals(java.util.Set.of(firstId, secondId, thirdId), collected);
	}

	@Test
	void downloadAlbumReturnsZipWithAllPhotos() throws IOException {
		String token = registerUserToken("download-happy");
		String albumId = createAlbum(token, "Download happy");
		String firstPhotoId = uploadNamedPhoto(token, "vacation.jpg", 61, 0xaa1122);
		String secondPhotoId = uploadNamedPhoto(token, "sunset.jpg", 62, 0x112233);
		authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, firstPhotoId).then()
				.statusCode(201);
		authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, secondPhotoId).then()
				.statusCode(201);

		byte[] zipBytes = authAs(token).when().get("/api/v1/albums/{id}/download", albumId).then().statusCode(200)
				.contentType("application/zip").header("Content-Disposition", containsString("attachment"))
				.header("Content-Disposition", containsString("download-happy.zip")).extract().asByteArray();

		assertEquals(Set.of("vacation.jpg", "sunset.jpg"), readZipEntryNames(zipBytes));
	}

	@Test
	void downloadAlbumDisambiguatesCollidingFilenames() throws IOException {
		String token = registerUserToken("download-collide");
		String albumId = createAlbum(token, "Collide");
		String firstPhotoId = uploadNamedPhoto(token, "photo.jpg", 61, 0x331122);
		String secondPhotoId = uploadNamedPhoto(token, "photo.jpg", 62, 0x442233);
		authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, firstPhotoId).then()
				.statusCode(201);
		authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, secondPhotoId).then()
				.statusCode(201);

		byte[] zipBytes = authAs(token).when().get("/api/v1/albums/{id}/download", albumId).then().statusCode(200)
				.extract().asByteArray();

		assertEquals(Set.of("photo.jpg", "photo (1).jpg"), readZipEntryNames(zipBytes));
	}

	@Test
	void downloadAlbumSanitizesPathLikeFilenamesBeforeDeduplication() throws IOException {
		String token = registerUserToken("download-sanitize");
		String albumId = createAlbum(token, "Sanitize");
		String firstPhotoId = uploadNamedPhoto(token, "../../secrets.txt", 61, 0x113355);
		String secondPhotoId = uploadNamedPhoto(token, "nested\\secrets.txt", 62, 0x224466);
		authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, firstPhotoId).then()
				.statusCode(201);
		authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, secondPhotoId).then()
				.statusCode(201);

		byte[] zipBytes = authAs(token).when().get("/api/v1/albums/{id}/download", albumId).then().statusCode(200)
				.extract().asByteArray();

		assertEquals(Set.of("secrets.txt", "secrets (1).txt"), readZipEntryNames(zipBytes));
	}

	@Test
	void downloadAlbumWithCompressedVariantReturnsZipOfCompressed() throws IOException {
		String token = registerUserToken("download-compressed");
		String albumId = createAlbum(token, "Compressed");
		String photoId = uploadNamedPhoto(token, "large.jpg", 120, 0x99ccee);
		authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, photoId).then().statusCode(201);

		byte[] zipBytes = authAs(token).queryParam("variant", "COMPRESSED").when()
				.get("/api/v1/albums/{id}/download", albumId).then().statusCode(200).contentType("application/zip")
				.extract().asByteArray();

		assertEquals(Set.of("large.jpg"), readZipEntryNames(zipBytes));
	}

	@Test
	void downloadAlbumInvalidVariantReturns400() {
		String token = registerUserToken("download-bad-variant");
		String albumId = createAlbum(token, "Bad variant");
		authAs(token).queryParam("variant", "BOGUS").when().get("/api/v1/albums/{id}/download", albumId).then()
				.statusCode(400).body("error", equalTo("bad_request"));
	}

	@Test
	void downloadAlbumByNonOwnerReturns404() throws IOException {
		String ownerToken = registerUserToken("download-owner");
		String intruderToken = registerUserToken("download-intruder");
		String albumId = createAlbum(ownerToken, "Private download");
		String photoId = uploadNamedPhoto(ownerToken, "priv.jpg", 60, 0x665544);
		authAs(ownerToken).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, photoId).then()
				.statusCode(201);

		authAs(intruderToken).when().get("/api/v1/albums/{id}/download", albumId).then().statusCode(404).body("error",
				equalTo("not_found"));
	}

	@Test
	void downloadEmptyAlbumReturnsEmptyZip() throws IOException {
		String token = registerUserToken("download-empty");
		String albumId = createAlbum(token, "Empty download");

		byte[] zipBytes = authAs(token).when().get("/api/v1/albums/{id}/download", albumId).then().statusCode(200)
				.contentType("application/zip").extract().asByteArray();

		assertEquals(Set.of(), readZipEntryNames(zipBytes));
	}

	private Set<String> readZipEntryNames(byte[] zipBytes) throws IOException {
		Set<String> names = new HashSet<>();
		try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(zipBytes))) {
			ZipEntry entry;
			while ((entry = zip.getNextEntry()) != null) {
				names.add(entry.getName());
				zip.closeEntry();
			}
		}
		return names;
	}

	private String uploadNamedPhoto(String token, String filename, int size, int rgb) throws IOException {
		String nonce = UUID.randomUUID().toString().substring(0, 6);
		Path image = createJpegImage("download-" + nonce, size, size, rgb);
		return authAs(token).multiPart("file", filename, Files.readAllBytes(image), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
	}

	private String createAlbum(String token, String name) {
		return authAs(token).contentType(ContentType.JSON).body("{\"name\": \"" + name + "\"}").when()
				.post("/api/v1/albums").then().statusCode(201).extract().path("id");
	}

	private String uploadPhoto(String token, String prefix, int rgb) throws IOException {
		Path image = createJpegImage(prefix, 60, 60, rgb);
		return authAs(token).multiPart("file", image.toFile(), "image/jpeg").when().post("/api/v1/photos").then()
				.statusCode(201).extract().path("id");
	}

	private void addUniquePhotos(String token, String albumId, int count) throws IOException {
		for (int i = 0; i < count; i++) {
			String suffix = UUID.randomUUID().toString().substring(0, 6);
			Path image = createJpegImage("sort-count-" + suffix, 60 + i, 60 + i, 0x112233 ^ (i * 0x55AA77));
			String photoId = authAs(token).multiPart("file", image.toFile(), "image/jpeg").when().post("/api/v1/photos")
					.then().statusCode(201).extract().path("id");
			authAs(token).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, photoId).then()
					.statusCode(201);
		}
	}
}
