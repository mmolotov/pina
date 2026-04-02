package dev.pina.backend.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;

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
class FavoriteResourceTest {

	private static String registerUser(String suffix) {
		String username = "fav-test-" + suffix + "-" + UUID.randomUUID().toString().substring(0, 8);
		return given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");
	}

	private static RequestSpecification authAs(String token) {
		return given().header("Authorization", "Bearer " + token).contentType(ContentType.JSON);
	}

	private static UUID uploadPhoto(String token) throws IOException {
		Path image = createJpegImage("fav-test-photo");
		return UUID.fromString(
				given().header("Authorization", "Bearer " + token).multiPart("file", image.toFile(), "image/jpeg")
						.when().post("/api/v1/photos").then().statusCode(201).extract().path("id"));
	}

	private static UUID createAlbum(String token) {
		return UUID.fromString(authAs(token).body("{\"name\":\"Fav Test Album\"}").when().post("/api/v1/albums").then()
				.statusCode(201).extract().path("id"));
	}

	private static UUID createSpace(String token, String name) {
		return UUID.fromString(authAs(token).body("{\"name\":\"" + name + "\"}").when().post("/api/v1/spaces").then()
				.statusCode(201).extract().path("id"));
	}

	private static UUID createSpaceAlbum(String token, UUID spaceId, String name) {
		return UUID.fromString(authAs(token).body("{\"name\":\"" + name + "\"}").when()
				.post("/api/v1/spaces/" + spaceId + "/albums").then().statusCode(201).extract().path("id"));
	}

	private static UUID currentUserId(String token) {
		return UUID.fromString(authAs(token).when().get("/api/v1/auth/me").then().statusCode(200).extract().path("id"));
	}

	private static void addMember(String ownerToken, UUID spaceId, UUID userId, String role) {
		authAs(ownerToken).body("{\"userId\":\"" + userId + "\",\"role\":\"" + role + "\"}").when()
				.post("/api/v1/spaces/" + spaceId + "/members").then().statusCode(201);
	}

	private static void removeMember(String actorToken, UUID spaceId, UUID userId) {
		authAs(actorToken).when().delete("/api/v1/spaces/" + spaceId + "/members/" + userId).then().statusCode(204);
	}

	private static void addPhotoToSpaceAlbum(String token, UUID spaceId, UUID albumId, UUID photoId) {
		authAs(token).when().post("/api/v1/spaces/" + spaceId + "/albums/" + albumId + "/photos/" + photoId).then()
				.statusCode(201);
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
	void addPhotoFavoriteReturns201() throws IOException {
		String token = registerUser("add");
		UUID photoId = uploadPhoto(token);

		authAs(token).body("{\"targetType\":\"PHOTO\",\"targetId\":\"" + photoId + "\"}").when()
				.post("/api/v1/favorites").then().statusCode(201);
	}

	@Test
	void addDuplicateFavoriteReturns200() throws IOException {
		String token = registerUser("dup");
		UUID photoId = uploadPhoto(token);

		authAs(token).body("{\"targetType\":\"PHOTO\",\"targetId\":\"" + photoId + "\"}").when()
				.post("/api/v1/favorites").then().statusCode(201);
		authAs(token).body("{\"targetType\":\"PHOTO\",\"targetId\":\"" + photoId + "\"}").when()
				.post("/api/v1/favorites").then().statusCode(200);
	}

	@Test
	void addFavoriteForNonexistentTargetReturns404() {
		String token = registerUser("ne");
		authAs(token).body("{\"targetType\":\"PHOTO\",\"targetId\":\"" + UUID.randomUUID() + "\"}").when()
				.post("/api/v1/favorites").then().statusCode(404);
	}

	@Test
	void removeFavoriteReturns204() throws IOException {
		String token = registerUser("rm");
		UUID photoId = uploadPhoto(token);

		authAs(token).body("{\"targetType\":\"PHOTO\",\"targetId\":\"" + photoId + "\"}").when()
				.post("/api/v1/favorites").then().statusCode(201);

		String favId = authAs(token).when().get("/api/v1/favorites").then().statusCode(200).body("$", hasSize(1))
				.extract().path("[0].id");

		authAs(token).when().delete("/api/v1/favorites/" + favId).then().statusCode(204);

		authAs(token).when().get("/api/v1/favorites").then().statusCode(200).body("$", hasSize(0));
	}

	@Test
	void removeNonexistentFavoriteReturns404() {
		String token = registerUser("rm-ne");
		authAs(token).when().delete("/api/v1/favorites/" + UUID.randomUUID()).then().statusCode(404);
	}

	@Test
	void listFavoritesFiltersByType() throws IOException {
		String token = registerUser("filter");
		UUID photoId = uploadPhoto(token);
		UUID albumId = createAlbum(token);

		authAs(token).body("{\"targetType\":\"PHOTO\",\"targetId\":\"" + photoId + "\"}").when()
				.post("/api/v1/favorites").then().statusCode(201);
		authAs(token).body("{\"targetType\":\"ALBUM\",\"targetId\":\"" + albumId + "\"}").when()
				.post("/api/v1/favorites").then().statusCode(201);

		authAs(token).when().get("/api/v1/favorites").then().statusCode(200).body("$", hasSize(2));
		authAs(token).when().get("/api/v1/favorites?type=PHOTO").then().statusCode(200).body("$", hasSize(1))
				.body("[0].targetType", equalTo("PHOTO"));
		authAs(token).when().get("/api/v1/favorites?type=ALBUM").then().statusCode(200).body("$", hasSize(1))
				.body("[0].targetType", equalTo("ALBUM"));
	}

	@Test
	void checkFavoriteStatus() throws IOException {
		String token = registerUser("check");
		UUID photoId = uploadPhoto(token);

		authAs(token).when().get("/api/v1/favorites/check?targetType=PHOTO&targetId=" + photoId).then().statusCode(200)
				.body("favorited", equalTo(false));

		authAs(token).body("{\"targetType\":\"PHOTO\",\"targetId\":\"" + photoId + "\"}").when()
				.post("/api/v1/favorites").then().statusCode(201);

		authAs(token).when().get("/api/v1/favorites/check?targetType=PHOTO&targetId=" + photoId).then().statusCode(200)
				.body("favorited", equalTo(true));
	}

	@Test
	void checkWithoutParamsReturns400() {
		String token = registerUser("check-bad");
		authAs(token).when().get("/api/v1/favorites/check").then().statusCode(400);
	}

	@Test
	void addAlbumFavoriteReturns201() {
		String token = registerUser("album-fav");
		UUID albumId = createAlbum(token);

		authAs(token).body("{\"targetType\":\"ALBUM\",\"targetId\":\"" + albumId + "\"}").when()
				.post("/api/v1/favorites").then().statusCode(201);
	}

	@Test
	void cannotFavoriteOtherUsersPhoto() throws IOException {
		String token1 = registerUser("own1");
		String token2 = registerUser("own2");
		UUID photoId = uploadPhoto(token1);

		authAs(token2).body("{\"targetType\":\"PHOTO\",\"targetId\":\"" + photoId + "\"}").when()
				.post("/api/v1/favorites").then().statusCode(404);
	}

	@Test
	void deletingPhotoRemovesFavorite() throws IOException {
		String token = registerUser("photo-cleanup");
		UUID photoId = uploadPhoto(token);

		authAs(token).body("{\"targetType\":\"PHOTO\",\"targetId\":\"" + photoId + "\"}").when()
				.post("/api/v1/favorites").then().statusCode(201);

		given().header("Authorization", "Bearer " + token).when().delete("/api/v1/photos/{id}", photoId).then()
				.statusCode(204);

		authAs(token).when().get("/api/v1/favorites").then().statusCode(200).body("$", hasSize(0));
		authAs(token).when().get("/api/v1/favorites/check?targetType=PHOTO&targetId=" + photoId).then().statusCode(200)
				.body("favorited", equalTo(false));
	}

	@Test
	void deletingAlbumRemovesFavorite() {
		String token = registerUser("album-cleanup");
		UUID albumId = createAlbum(token);

		authAs(token).body("{\"targetType\":\"ALBUM\",\"targetId\":\"" + albumId + "\"}").when()
				.post("/api/v1/favorites").then().statusCode(201);

		given().header("Authorization", "Bearer " + token).when().delete("/api/v1/albums/{id}", albumId).then()
				.statusCode(204);

		authAs(token).when().get("/api/v1/favorites").then().statusCode(200).body("$", hasSize(0));
		authAs(token).when().get("/api/v1/favorites/check?targetType=ALBUM&targetId=" + albumId).then().statusCode(200)
				.body("favorited", equalTo(false));
	}

	@Test
	void favoritesListHidesTargetsAfterSpaceAccessIsRevoked() throws IOException {
		String ownerToken = registerUser("revoke-access-owner");
		String memberToken = registerUser("revoke-access-member");
		UUID memberId = currentUserId(memberToken);
		UUID spaceId = createSpace(ownerToken, "Hidden Favorites Space");
		addMember(ownerToken, spaceId, memberId, "MEMBER");

		UUID photoId = uploadPhoto(ownerToken);
		UUID albumId = createSpaceAlbum(ownerToken, spaceId, "Hidden Favorites Album");
		addPhotoToSpaceAlbum(ownerToken, spaceId, albumId, photoId);

		authAs(memberToken).body("{\"targetType\":\"PHOTO\",\"targetId\":\"" + photoId + "\"}").when()
				.post("/api/v1/favorites").then().statusCode(201);
		authAs(memberToken).body("{\"targetType\":\"ALBUM\",\"targetId\":\"" + albumId + "\"}").when()
				.post("/api/v1/favorites").then().statusCode(201);

		removeMember(ownerToken, spaceId, memberId);

		authAs(memberToken).when().get("/api/v1/favorites").then().statusCode(200).body("$", hasSize(0));
		authAs(memberToken).when().get("/api/v1/favorites/check?targetType=PHOTO&targetId=" + photoId).then()
				.statusCode(200).body("favorited", equalTo(false));
		authAs(memberToken).when().get("/api/v1/favorites/check?targetType=ALBUM&targetId=" + albumId).then()
				.statusCode(200).body("favorited", equalTo(false));
	}

	@Test
	void memberOwnedSpaceAlbumFavoriteIsHiddenAfterSpaceRemoval() {
		String ownerToken = registerUser("space-owner-loss-owner");
		String memberToken = registerUser("space-owner-loss-member");
		UUID memberId = currentUserId(memberToken);
		UUID spaceId = createSpace(ownerToken, "Owned Space Album Visibility");
		addMember(ownerToken, spaceId, memberId, "MEMBER");

		UUID memberOwnedAlbumId = createSpaceAlbum(memberToken, spaceId, "Member-Owned Space Album");
		authAs(memberToken).body("{\"targetType\":\"ALBUM\",\"targetId\":\"" + memberOwnedAlbumId + "\"}").when()
				.post("/api/v1/favorites").then().statusCode(201);

		removeMember(ownerToken, spaceId, memberId);

		authAs(memberToken).when().get("/api/v1/favorites?type=ALBUM").then().statusCode(200).body("$", hasSize(0));
		authAs(memberToken).when().get("/api/v1/favorites/check?targetType=ALBUM&targetId=" + memberOwnedAlbumId).then()
				.statusCode(200).body("favorited", equalTo(false));
	}
}
