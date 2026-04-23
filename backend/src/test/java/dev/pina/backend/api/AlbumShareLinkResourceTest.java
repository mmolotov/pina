package dev.pina.backend.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AlbumShareLinkResourceTest {

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
		String username = "share-" + suffix + "-" + UUID.randomUUID().toString().substring(0, 8);
		return given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");
	}

	private RequestSpecification authAs(String accessToken) {
		return given().header("Authorization", "Bearer " + accessToken);
	}

	private String createAlbum(String accessToken, String name) {
		return authAs(accessToken).contentType(ContentType.JSON).body("{\"name\": \"" + name + "\"}").when()
				.post("/api/v1/albums").then().statusCode(201).extract().path("id");
	}

	private String uploadPhoto(String accessToken, String prefix, int rgb) throws IOException {
		Path image = createJpegImage(prefix, 80, 80, rgb);
		return authAs(accessToken).multiPart("file", image.toFile(), "image/jpeg").when().post("/api/v1/photos").then()
				.statusCode(201).extract().path("id");
	}

	private void addPhoto(String accessToken, String albumId, String photoId) {
		authAs(accessToken).when().post("/api/v1/albums/{albumId}/photos/{photoId}", albumId, photoId).then()
				.statusCode(201);
	}

	@Test
	void createShareLinkReturnsTokenOnceAndListOmitsToken() {
		String ownerToken = registerUserToken("create-list");
		String albumId = createAlbum(ownerToken, "Share me");

		String shareToken = authAs(ownerToken).contentType(ContentType.JSON).body("{}").when()
				.post("/api/v1/albums/{id}/share-links", albumId).then().statusCode(201).body("link.id", notNullValue())
				.body("link.albumId", equalTo(albumId)).body("link.revokedAt", org.hamcrest.Matchers.nullValue())
				.body("token", notNullValue()).extract().path("token");
		assertTrue(shareToken != null && shareToken.length() >= 32, "token should be a non-trivial random string");

		authAs(ownerToken).when().get("/api/v1/albums/{id}/share-links", albumId).then().statusCode(200)
				.body("$", hasSize(1)).body("[0].albumId", equalTo(albumId))
				.body("[0].token", org.hamcrest.Matchers.nullValue());
	}

	@Test
	void nonOwnerCannotCreateListOrRevokeShareLinks() {
		String ownerToken = registerUserToken("owner-only");
		String intruderToken = registerUserToken("intruder");
		String albumId = createAlbum(ownerToken, "Private");

		authAs(intruderToken).contentType(ContentType.JSON).body("{}").when()
				.post("/api/v1/albums/{id}/share-links", albumId).then().statusCode(404);
		authAs(intruderToken).when().get("/api/v1/albums/{id}/share-links", albumId).then().statusCode(404);

		String linkId = authAs(ownerToken).contentType(ContentType.JSON).body("{}").when()
				.post("/api/v1/albums/{id}/share-links", albumId).then().statusCode(201).extract().path("link.id");

		authAs(intruderToken).when().delete("/api/v1/albums/{id}/share-links/{linkId}", albumId, linkId).then()
				.statusCode(404);
	}

	@Test
	void publicAccessWithValidTokenReturnsAlbumAndPhotos() throws IOException {
		String ownerToken = registerUserToken("public-access");
		String albumId = createAlbum(ownerToken, "Public album");
		String firstPhoto = uploadPhoto(ownerToken, "public-1", 0x223344);
		String secondPhoto = uploadPhoto(ownerToken, "public-2", 0x998877);
		addPhoto(ownerToken, albumId, firstPhoto);
		addPhoto(ownerToken, albumId, secondPhoto);

		String shareToken = authAs(ownerToken).contentType(ContentType.JSON).body("{}").when()
				.post("/api/v1/albums/{id}/share-links", albumId).then().statusCode(201).extract().path("token");

		given().when().get("/api/v1/public/albums/by-token/{token}", shareToken).then().statusCode(200)
				.body("album.id", equalTo(albumId)).body("album.name", equalTo("Public album"))
				.body("photos.items", hasSize(2));
	}

	@Test
	void publicAccessWithInvalidTokenReturns404() {
		given().when().get("/api/v1/public/albums/by-token/{token}", "not-a-real-token").then().statusCode(404);
	}

	@Test
	void revokedShareLinkReturns404ForPublicReads() throws IOException {
		String ownerToken = registerUserToken("revoke");
		String albumId = createAlbum(ownerToken, "Revoke me");
		String photoId = uploadPhoto(ownerToken, "revoke-photo", 0x112244);
		addPhoto(ownerToken, albumId, photoId);

		var createResponse = authAs(ownerToken).contentType(ContentType.JSON).body("{}").when()
				.post("/api/v1/albums/{id}/share-links", albumId).then().statusCode(201).extract();
		String shareToken = createResponse.path("token");
		String linkId = createResponse.path("link.id");

		given().when().get("/api/v1/public/albums/by-token/{token}", shareToken).then().statusCode(200);

		authAs(ownerToken).when().delete("/api/v1/albums/{id}/share-links/{linkId}", albumId, linkId).then()
				.statusCode(204);

		given().when().get("/api/v1/public/albums/by-token/{token}", shareToken).then().statusCode(404);
		given().when().get("/api/v1/public/albums/by-token/{token}/photos/{photoId}/file", shareToken, photoId).then()
				.statusCode(404);
	}

	@Test
	void expiredShareLinkReturns404() {
		String ownerToken = registerUserToken("expired");
		String albumId = createAlbum(ownerToken, "Expired");
		String pastExpiry = OffsetDateTime.now().minusHours(1).toString();

		String shareToken = authAs(ownerToken).contentType(ContentType.JSON)
				.body("{\"expiresAt\": \"" + pastExpiry + "\"}").when().post("/api/v1/albums/{id}/share-links", albumId)
				.then().statusCode(201).extract().path("token");

		given().when().get("/api/v1/public/albums/by-token/{token}", shareToken).then().statusCode(404);
	}

	@Test
	void publicPhotoFileProxyStreamsBytes() throws IOException {
		String ownerToken = registerUserToken("photo-proxy");
		String albumId = createAlbum(ownerToken, "Proxy album");
		String photoId = uploadPhoto(ownerToken, "proxy", 0xaa5566);
		addPhoto(ownerToken, albumId, photoId);

		String shareToken = authAs(ownerToken).contentType(ContentType.JSON).body("{}").when()
				.post("/api/v1/albums/{id}/share-links", albumId).then().statusCode(201).extract().path("token");

		byte[] bytes = given().when()
				.get("/api/v1/public/albums/by-token/{token}/photos/{photoId}/file?variant=COMPRESSED", shareToken,
						photoId)
				.then().statusCode(200).extract().asByteArray();
		assertTrue(bytes.length > 0, "proxy should stream non-empty bytes");
	}

	@Test
	void publicPhotoFileRejectsInvalidVariant() throws IOException {
		String ownerToken = registerUserToken("bad-variant");
		String albumId = createAlbum(ownerToken, "Variant album");
		String photoId = uploadPhoto(ownerToken, "bad-variant-photo", 0x557788);
		addPhoto(ownerToken, albumId, photoId);

		String shareToken = authAs(ownerToken).contentType(ContentType.JSON).body("{}").when()
				.post("/api/v1/albums/{id}/share-links", albumId).then().statusCode(201).extract().path("token");

		given().when()
				.get("/api/v1/public/albums/by-token/{token}/photos/{photoId}/file?variant=BOGUS", shareToken, photoId)
				.then().statusCode(400).body("error", equalTo("bad_request"));
	}

	@Test
	void publicPhotoFileRequiresPhotoInAlbum() throws IOException {
		String ownerToken = registerUserToken("foreign-photo");
		String albumId = createAlbum(ownerToken, "Member-only album");
		String memberPhoto = uploadPhoto(ownerToken, "member-photo", 0x445566);
		addPhoto(ownerToken, albumId, memberPhoto);
		String orphanPhoto = uploadPhoto(ownerToken, "orphan-photo", 0x99aabb);

		String shareToken = authAs(ownerToken).contentType(ContentType.JSON).body("{}").when()
				.post("/api/v1/albums/{id}/share-links", albumId).then().statusCode(201).extract().path("token");

		given().when().get("/api/v1/public/albums/by-token/{token}/photos/{photoId}/file", shareToken, orphanPhoto)
				.then().statusCode(404);
	}
}
