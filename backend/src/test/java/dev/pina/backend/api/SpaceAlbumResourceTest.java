package dev.pina.backend.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;

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
class SpaceAlbumResourceTest {

	private static String registerUser(String suffix) {
		String username = "sa-test-" + suffix + "-" + UUID.randomUUID().toString().substring(0, 8);
		return given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");
	}

	private static RequestSpecification authAs(String token) {
		return given().header("Authorization", "Bearer " + token).contentType(ContentType.JSON);
	}

	private static String createSpace(String token, String name) {
		return authAs(token).body("{\"name\":\"" + name + "\"}").when().post("/api/v1/spaces").then().statusCode(201)
				.extract().path("id");
	}

	private static String addMember(String ownerToken, String spaceId, String memberToken, String role) {
		String memberId = authAs(memberToken).when().get("/api/v1/auth/me").then().statusCode(200).extract().path("id");
		authAs(ownerToken).body("{\"userId\":\"" + memberId + "\",\"role\":\"" + role + "\"}").when()
				.post("/api/v1/spaces/" + spaceId + "/members").then().statusCode(201);
		return memberId;
	}

	private static UUID uploadPhoto(String token) throws IOException {
		Path image = createJpegImage("sa-test-photo");
		return UUID.fromString(
				given().header("Authorization", "Bearer " + token).multiPart("file", image.toFile(), "image/jpeg")
						.when().post("/api/v1/photos").then().statusCode(201).extract().path("id"));
	}

	private static Path createJpegImage(String prefix) throws IOException {
		Path image = Files.createTempFile(prefix, ".jpg");
		BufferedImage img = new BufferedImage(50, 50, BufferedImage.TYPE_INT_RGB);
		var g = img.createGraphics();
		g.setColor(new java.awt.Color(UUID.randomUUID().hashCode() & 0xFFFFFF));
		g.fillRect(0, 0, 50, 50);
		g.dispose();
		ImageIO.write(img, "jpg", image.toFile());
		return image;
	}

	@Test
	void createSpaceAlbumReturns201() {
		String token = registerUser("create");
		String spaceId = createSpace(token, "Album Space");

		authAs(token).body("{\"name\":\"Space Album\"}").when().post("/api/v1/spaces/" + spaceId + "/albums").then()
				.statusCode(201).body("name", equalTo("Space Album")).body("spaceId", equalTo(spaceId))
				.body("id", notNullValue());
	}

	@Test
	void listSpaceAlbums() {
		String token = registerUser("list");
		String spaceId = createSpace(token, "List Album Space");

		authAs(token).body("{\"name\":\"Album 1\"}").when().post("/api/v1/spaces/" + spaceId + "/albums").then()
				.statusCode(201);
		authAs(token).body("{\"name\":\"Album 2\"}").when().post("/api/v1/spaces/" + spaceId + "/albums").then()
				.statusCode(201);

		authAs(token).when().get("/api/v1/spaces/" + spaceId + "/albums").then().statusCode(200).body("items",
				hasSize(2));
	}

	@Test
	void memberCanCreateSpaceAlbum() {
		String ownerToken = registerUser("sa-owner");
		String memberToken = registerUser("sa-member");
		String spaceId = createSpace(ownerToken, "Member Album Space");
		addMember(ownerToken, spaceId, memberToken, "MEMBER");

		authAs(memberToken).body("{\"name\":\"Member Album\"}").when().post("/api/v1/spaces/" + spaceId + "/albums")
				.then().statusCode(201);
	}

	@Test
	void nonMemberCannotAccessSpaceAlbums() {
		String ownerToken = registerUser("sa-nm-owner");
		String otherToken = registerUser("sa-nm-other");
		String spaceId = createSpace(ownerToken, "Private Album Space");

		authAs(otherToken).when().get("/api/v1/spaces/" + spaceId + "/albums").then().statusCode(404);
	}

	@Test
	void updateSpaceAlbumByOwner() {
		String token = registerUser("update");
		String spaceId = createSpace(token, "Update Album Space");

		String albumId = authAs(token).body("{\"name\":\"Original\"}").when()
				.post("/api/v1/spaces/" + spaceId + "/albums").then().statusCode(201).extract().path("id");

		authAs(token).body("{\"name\":\"Updated\"}").when().put("/api/v1/spaces/" + spaceId + "/albums/" + albumId)
				.then().statusCode(200).body("name", equalTo("Updated"));
	}

	@Test
	void deleteSpaceAlbum() {
		String token = registerUser("delete");
		String spaceId = createSpace(token, "Delete Album Space");

		String albumId = authAs(token).body("{\"name\":\"To Delete\"}").when()
				.post("/api/v1/spaces/" + spaceId + "/albums").then().statusCode(201).extract().path("id");

		authAs(token).when().delete("/api/v1/spaces/" + spaceId + "/albums/" + albumId).then().statusCode(204);

		authAs(token).when().get("/api/v1/spaces/" + spaceId + "/albums").then().statusCode(200).body("items",
				hasSize(0));
	}

	@Test
	void addPhotoToSpaceAlbum() throws IOException {
		String token = registerUser("add-photo");
		String spaceId = createSpace(token, "Photo Album Space");
		UUID photoId = uploadPhoto(token);

		String albumId = authAs(token).body("{\"name\":\"Photo Album\"}").when()
				.post("/api/v1/spaces/" + spaceId + "/albums").then().statusCode(201).extract().path("id");

		authAs(token).when().post("/api/v1/spaces/" + spaceId + "/albums/" + albumId + "/photos/" + photoId).then()
				.statusCode(201);
	}

	@Test
	void listPhotosInSpaceAlbum() throws IOException {
		String token = registerUser("list-photos");
		String spaceId = createSpace(token, "List Photo Space");
		UUID photoId = uploadPhoto(token);

		String albumId = authAs(token).body("{\"name\":\"List Photo Album\"}").when()
				.post("/api/v1/spaces/" + spaceId + "/albums").then().statusCode(201).extract().path("id");

		authAs(token).when().post("/api/v1/spaces/" + spaceId + "/albums/" + albumId + "/photos/" + photoId).then()
				.statusCode(201);

		authAs(token).when().get("/api/v1/spaces/" + spaceId + "/albums/" + albumId + "/photos").then().statusCode(200)
				.body("items", hasSize(1));
	}

	@Test
	void viewerCanListAlbumsAndPhotos() throws IOException {
		String ownerToken = registerUser("viewer-owner");
		String viewerToken = registerUser("viewer-user");
		String spaceId = createSpace(ownerToken, "Viewer Space");
		addMember(ownerToken, spaceId, viewerToken, "VIEWER");

		UUID photoId = uploadPhoto(ownerToken);
		String albumId = authAs(ownerToken).body("{\"name\":\"Viewer Album\"}").when()
				.post("/api/v1/spaces/" + spaceId + "/albums").then().statusCode(201).extract().path("id");
		authAs(ownerToken).when().post("/api/v1/spaces/" + spaceId + "/albums/" + albumId + "/photos/" + photoId).then()
				.statusCode(201);

		authAs(viewerToken).when().get("/api/v1/spaces/" + spaceId + "/albums").then().statusCode(200).body("items",
				hasSize(1));
		authAs(viewerToken).when().get("/api/v1/spaces/" + spaceId + "/albums/" + albumId + "/photos").then()
				.statusCode(200).body("items", hasSize(1));
	}

	@Test
	void viewerCanDownloadPhotoFileFromSpaceAlbum() throws IOException {
		String ownerToken = registerUser("viewer-file-owner");
		String viewerToken = registerUser("viewer-file-user");
		String spaceId = createSpace(ownerToken, "Viewer File Space");
		addMember(ownerToken, spaceId, viewerToken, "VIEWER");

		UUID photoId = uploadPhoto(ownerToken);
		String albumId = authAs(ownerToken).body("{\"name\":\"Viewer File Album\"}").when()
				.post("/api/v1/spaces/" + spaceId + "/albums").then().statusCode(201).extract().path("id");
		authAs(ownerToken).when().post("/api/v1/spaces/" + spaceId + "/albums/" + albumId + "/photos/" + photoId).then()
				.statusCode(201);

		authAs(viewerToken).when().get(
				"/api/v1/spaces/" + spaceId + "/albums/" + albumId + "/photos/" + photoId + "/file?variant=COMPRESSED")
				.then().statusCode(200).contentType(equalTo("image/jpeg"));
	}

	@Test
	void memberCannotUpdateOthersAlbumWithoutAdmin() {
		String ownerToken = registerUser("nomgr-owner");
		String memberToken = registerUser("nomgr-member");
		String spaceId = createSpace(ownerToken, "NoMgr Space");
		addMember(ownerToken, spaceId, memberToken, "MEMBER");

		String albumId = authAs(ownerToken).body("{\"name\":\"Owner Album\"}").when()
				.post("/api/v1/spaces/" + spaceId + "/albums").then().statusCode(201).extract().path("id");

		authAs(memberToken).body("{\"name\":\"Hacked\"}").when().put("/api/v1/spaces/" + spaceId + "/albums/" + albumId)
				.then().statusCode(404);
	}

	@Test
	void removePhotoFromSpaceAlbum() throws IOException {
		String token = registerUser("rm-photo");
		String spaceId = createSpace(token, "Remove Photo Space");
		UUID photoId = uploadPhoto(token);

		String albumId = authAs(token).body("{\"name\":\"Remove Album\"}").when()
				.post("/api/v1/spaces/" + spaceId + "/albums").then().statusCode(201).extract().path("id");

		authAs(token).when().post("/api/v1/spaces/" + spaceId + "/albums/" + albumId + "/photos/" + photoId).then()
				.statusCode(201);
		authAs(token).when().delete("/api/v1/spaces/" + spaceId + "/albums/" + albumId + "/photos/" + photoId).then()
				.statusCode(204);

		authAs(token).when().get("/api/v1/spaces/" + spaceId + "/albums/" + albumId + "/photos").then().statusCode(200)
				.body("items", hasSize(0));
	}

	@Test
	void memberCannotAddOtherUsersPhotoToSpaceAlbum() throws IOException {
		String ownerToken = registerUser("foreign-photo-owner");
		String memberToken = registerUser("foreign-photo-member");
		String spaceId = createSpace(ownerToken, "Foreign Photo Space");
		addMember(ownerToken, spaceId, memberToken, "MEMBER");

		UUID ownerPhotoId = uploadPhoto(ownerToken);
		String albumId = authAs(memberToken).body("{\"name\":\"Member Album\"}").when()
				.post("/api/v1/spaces/" + spaceId + "/albums").then().statusCode(201).extract().path("id");

		authAs(memberToken).when().post("/api/v1/spaces/" + spaceId + "/albums/" + albumId + "/photos/" + ownerPhotoId)
				.then().statusCode(404);
	}

	@Test
	void memberCannotRemoveOtherUsersPhotoFromSpaceAlbum() throws IOException {
		String ownerToken = registerUser("rm-foreign-owner");
		String memberToken = registerUser("rm-foreign-member");
		String spaceId = createSpace(ownerToken, "Remove Foreign Photo Space");
		addMember(ownerToken, spaceId, memberToken, "MEMBER");

		UUID ownerPhotoId = uploadPhoto(ownerToken);
		String albumId = authAs(ownerToken).body("{\"name\":\"Owner Album\"}").when()
				.post("/api/v1/spaces/" + spaceId + "/albums").then().statusCode(201).extract().path("id");
		authAs(ownerToken).when().post("/api/v1/spaces/" + spaceId + "/albums/" + albumId + "/photos/" + ownerPhotoId)
				.then().statusCode(201);

		authAs(memberToken).when()
				.delete("/api/v1/spaces/" + spaceId + "/albums/" + albumId + "/photos/" + ownerPhotoId).then()
				.statusCode(404);

		authAs(ownerToken).when().get("/api/v1/spaces/" + spaceId + "/albums/" + albumId + "/photos").then()
				.statusCode(200).body("items", hasSize(1));
	}
}
