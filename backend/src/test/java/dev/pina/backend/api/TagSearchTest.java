package dev.pina.backend.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;

import dev.pina.backend.domain.PhotoTag;
import io.quarkus.narayana.jta.QuarkusTransaction;
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

/** ML auto-tags as an additional photo match signal in /api/v1/search. */
@QuarkusTest
class TagSearchTest {

	@Test
	void tagMatchReturnsPhotoWithoutFilenameMatch() throws IOException {
		String token = registerUser("tag-basic");
		UUID photoId = uploadPhoto(token, "IMG_0001.jpg");
		insertTag(photoId, "glacier");

		authAs(token).when().get("/api/v1/search?q=glacier").then().statusCode(200).body("items", hasSize(1))
				.body("items[0].kind", equalTo("PHOTO")).body("items[0].photo.photo.id", equalTo(photoId.toString()));
	}

	@Test
	void exactTagMatchOutranksFilenamePrefixMatch() throws IOException {
		String token = registerUser("tag-rank");
		UUID taggedPhoto = uploadPhoto(token, "IMG_0002.jpg");
		insertTag(taggedPhoto, "sunset");
		UUID filenamePhoto = uploadPhoto(token, "sunset-trip.jpg");

		authAs(token).when().get("/api/v1/search?q=sunset&sort=relevance").then().statusCode(200)
				.body("items", hasSize(2)).body("items[0].photo.photo.id", equalTo(taggedPhoto.toString()))
				.body("items[1].photo.photo.id", equalTo(filenamePhoto.toString()));
	}

	@Test
	void containsTagMatchIsFound() throws IOException {
		String token = registerUser("tag-contains");
		UUID photoId = uploadPhoto(token, "IMG_0003.jpg");
		insertTag(photoId, "carnival parade");

		authAs(token).when().get("/api/v1/search?q=parade").then().statusCode(200).body("items", hasSize(1))
				.body("items[0].photo.photo.id", equalTo(photoId.toString()));
	}

	@Test
	void tagsOfOtherUsersStayInvisible() throws IOException {
		String ownerToken = registerUser("tag-owner");
		UUID photoId = uploadPhoto(ownerToken, "IMG_0004.jpg");
		insertTag(photoId, "zebra crossing");

		String strangerToken = registerUser("tag-stranger");
		authAs(strangerToken).when().get("/api/v1/search?q=zebra").then().statusCode(200).body("items", hasSize(0));
	}

	@Test
	void tagMatchAppliesToSpacePhotosForMembersOnly() throws IOException {
		String ownerToken = registerUser("tag-space-owner");
		String memberToken = registerUser("tag-space-member");
		String outsiderToken = registerUser("tag-space-outsider");

		UUID photoId = uploadPhoto(ownerToken, "IMG_0005.jpg");
		insertTag(photoId, "regatta");

		UUID spaceId = createSpace(ownerToken, "Tag Search Space");
		addMember(ownerToken, spaceId, memberToken, "VIEWER");
		UUID albumId = createSpaceAlbum(ownerToken, spaceId, "Shared Tagged Album");
		addPhotoToSpaceAlbum(ownerToken, spaceId, albumId, photoId);

		authAs(memberToken).when().get("/api/v1/search?q=regatta&scope=spaces").then().statusCode(200)
				.body("items", hasSize(1)).body("items[0].photo.photo.id", equalTo(photoId.toString()));

		authAs(outsiderToken).when().get("/api/v1/search?q=regatta&scope=spaces").then().statusCode(200).body("items",
				hasSize(0));
	}

	// --- helpers ---

	private static void insertTag(UUID photoId, String label) {
		QuarkusTransaction.requiringNew().run(() -> {
			PhotoTag tag = new PhotoTag();
			tag.photoId = photoId;
			tag.label = label;
			tag.confidence = 0.5f;
			tag.modelId = "tag-test";
			tag.modelVersion = "1.0";
			tag.persist();
		});
	}

	private static String registerUser(String suffix) {
		String username = "tag-search-" + suffix + "-" + UUID.randomUUID().toString().substring(0, 8);
		return given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");
	}

	private static RequestSpecification authAs(String token) {
		return given().header("Authorization", "Bearer " + token).contentType(ContentType.JSON);
	}

	private static String currentUserId(String token) {
		return authAs(token).when().get("/api/v1/auth/me").then().statusCode(200).extract().path("id");
	}

	private static UUID uploadPhoto(String token, String filename) throws IOException {
		Path dir = Files.createTempDirectory("tag-search-image");
		Path image = dir.resolve(filename);
		BufferedImage img = new BufferedImage(50, 50, BufferedImage.TYPE_INT_RGB);
		var graphics = img.createGraphics();
		graphics.setColor(new java.awt.Color(UUID.randomUUID().hashCode() & 0xFFFFFF));
		graphics.fillRect(0, 0, 50, 50);
		graphics.dispose();
		ImageIO.write(img, "jpg", image.toFile());
		return UUID.fromString(
				given().header("Authorization", "Bearer " + token).multiPart("file", image.toFile(), "image/jpeg")
						.when().post("/api/v1/photos").then().statusCode(201).extract().path("id"));
	}

	private static UUID createSpace(String token, String name) {
		return UUID.fromString(authAs(token).body("{\"name\":\"" + name + "\"}").when().post("/api/v1/spaces").then()
				.statusCode(201).extract().path("id"));
	}

	private static UUID createSpaceAlbum(String token, UUID spaceId, String name) {
		return UUID.fromString(authAs(token).body("{\"name\":\"" + name + "\"}").when()
				.post("/api/v1/spaces/" + spaceId + "/albums").then().statusCode(201).extract().path("id"));
	}

	private static void addPhotoToSpaceAlbum(String token, UUID spaceId, UUID albumId, UUID photoId) {
		authAs(token).when().post("/api/v1/spaces/" + spaceId + "/albums/" + albumId + "/photos/" + photoId).then()
				.statusCode(201);
	}

	private static void addMember(String ownerToken, UUID spaceId, String memberToken, String role) {
		String memberId = currentUserId(memberToken);
		authAs(ownerToken).body("{\"userId\":\"" + memberId + "\",\"role\":\"" + role + "\"}").when()
				.post("/api/v1/spaces/" + spaceId + "/members").then().statusCode(201);
	}
}
