package dev.pina.backend.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;

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
class TrashResourceTest {

	@Test
	void softDeletePhotoHidesFromLibraryAndAppearsInTrash() throws IOException {
		String token = registerUserToken("soft-hide");
		String photoId = uploadPhoto(token, "vacation.jpg");

		auth(token).when().get("/api/v1/photos").then().statusCode(200).body("items.id", hasItem(photoId));

		auth(token).when().delete("/api/v1/photos/{id}", photoId).then().statusCode(204);

		auth(token).when().get("/api/v1/photos").then().statusCode(200).body("items.id", not(hasItem(photoId)));
		auth(token).when().get("/api/v1/photos/{id}", photoId).then().statusCode(404);

		auth(token).when().get("/api/v1/trash").then().statusCode(200).body("items.id", hasItem(photoId))
				.body("items.find { it.id == '" + photoId + "' }.kind", equalTo("PHOTO"))
				.body("items.find { it.id == '" + photoId + "' }.name", equalTo("vacation.jpg"))
				.body("items.find { it.id == '" + photoId + "' }.daysLeft", greaterThan(0))
				.body("summary.totalItems", equalTo(1));
	}

	@Test
	void restoreReinstatesPhotoIntoLibraryAndAlbum() throws IOException {
		String token = registerUserToken("restore");
		String photoId = uploadPhoto(token, "restore-me.jpg");
		String albumId = createAlbum(token, "Restore album");
		auth(token).when().post("/api/v1/albums/{a}/photos/{p}", albumId, photoId).then().statusCode(201);

		auth(token).when().delete("/api/v1/photos/{id}", photoId).then().statusCode(204);
		auth(token).when().get("/api/v1/albums/{id}/photos", albumId).then().statusCode(200).body("items", hasSize(0));

		auth(token).contentType(ContentType.JSON).body("{\"items\":[{\"kind\":\"PHOTO\",\"id\":\"" + photoId + "\"}]}")
				.when().post("/api/v1/trash/restore").then().statusCode(204);

		auth(token).when().get("/api/v1/photos").then().statusCode(200).body("items.id", hasItem(photoId));
		auth(token).when().get("/api/v1/albums/{id}/photos", albumId).then().statusCode(200).body("items", hasSize(1))
				.body("items[0].id", equalTo(photoId));
		auth(token).when().get("/api/v1/trash").then().statusCode(200).body("summary.totalItems", equalTo(0));
	}

	@Test
	void albumSoftDeleteKeepsMemberPhotosAndRestoresMembership() throws IOException {
		String token = registerUserToken("album-trash");
		String photoId = uploadPhoto(token, "keep.jpg");
		String albumId = createAlbum(token, "Trashed album");
		auth(token).when().post("/api/v1/albums/{a}/photos/{p}", albumId, photoId).then().statusCode(201);

		auth(token).when().delete("/api/v1/albums/{id}", albumId).then().statusCode(204);

		auth(token).when().get("/api/v1/albums/{id}", albumId).then().statusCode(404);
		auth(token).when().get("/api/v1/albums").then().statusCode(200).body("items.id", not(hasItem(albumId)));
		// The member photo is untouched by trashing its album.
		auth(token).when().get("/api/v1/photos/{id}", photoId).then().statusCode(200);

		auth(token).when().get("/api/v1/trash").then().statusCode(200)
				.body("items.find { it.id == '" + albumId + "' }.kind", equalTo("ALBUM"))
				.body("items.find { it.id == '" + albumId + "' }.photoCount", equalTo(1))
				.body("items.find { it.id == '" + albumId + "' }.sizeBytes", equalTo(0));

		auth(token).contentType(ContentType.JSON).body("{\"items\":[{\"kind\":\"ALBUM\",\"id\":\"" + albumId + "\"}]}")
				.when().post("/api/v1/trash/restore").then().statusCode(204);
		auth(token).when().get("/api/v1/albums/{id}/photos", albumId).then().statusCode(200).body("items", hasSize(1))
				.body("items[0].id", equalTo(photoId));
	}

	@Test
	void trashFilterByKindAndSortByName() throws IOException {
		String token = registerUserToken("filter-sort");
		String alpha = uploadPhoto(token, "alpha.jpg");
		String zeta = uploadPhoto(token, "zeta.jpg");
		String albumId = createAlbum(token, "Some album");
		auth(token).when().delete("/api/v1/photos/{id}", alpha).then().statusCode(204);
		auth(token).when().delete("/api/v1/photos/{id}", zeta).then().statusCode(204);
		auth(token).when().delete("/api/v1/albums/{id}", albumId).then().statusCode(204);

		// kind=photo → only the two photos; summary still covers the whole trash.
		auth(token).queryParam("kind", "photo").when().get("/api/v1/trash").then().statusCode(200)
				.body("items", hasSize(2)).body("items.kind", everyItem(equalTo("PHOTO")))
				.body("summary.totalItems", equalTo(3));

		auth(token).queryParam("kind", "album").when().get("/api/v1/trash").then().statusCode(200)
				.body("items", hasSize(1)).body("items[0].kind", equalTo("ALBUM"))
				.body("items[0].id", equalTo(albumId));

		auth(token).queryParam("kind", "photo").queryParam("sort", "name").when().get("/api/v1/trash").then()
				.statusCode(200).body("items[0].name", equalTo("alpha.jpg")).body("items[1].name", equalTo("zeta.jpg"));

		auth(token).queryParam("kind", "bogus").when().get("/api/v1/trash").then().statusCode(400).body("error",
				equalTo("bad_request"));
	}

	@Test
	void bulkPurgeRemovesSelectedItemsPermanently() throws IOException {
		String token = registerUserToken("bulk-purge");
		String photoId = uploadPhoto(token, "doomed.jpg");
		String albumId = createAlbum(token, "Doomed album");
		auth(token).when().delete("/api/v1/photos/{id}", photoId).then().statusCode(204);
		auth(token).when().delete("/api/v1/albums/{id}", albumId).then().statusCode(204);

		auth(token)
				.contentType(ContentType.JSON).body("{\"items\":[{\"kind\":\"PHOTO\",\"id\":\"" + photoId
						+ "\"},{\"kind\":\"ALBUM\",\"id\":\"" + albumId + "\"}]}")
				.when().post("/api/v1/trash/purge").then().statusCode(204);

		auth(token).when().get("/api/v1/trash").then().statusCode(200).body("summary.totalItems", equalTo(0));
		auth(token).when().get("/api/v1/photos/{id}", photoId).then().statusCode(404);
	}

	@Test
	void emptyTrashPurgesAllOwnedItems() throws IOException {
		String token = registerUserToken("empty");
		String first = uploadPhoto(token, "a.jpg");
		String second = uploadPhoto(token, "b.jpg");
		String albumId = createAlbum(token, "Old album");
		auth(token).when().delete("/api/v1/photos/{id}", first).then().statusCode(204);
		auth(token).when().delete("/api/v1/photos/{id}", second).then().statusCode(204);
		auth(token).when().delete("/api/v1/albums/{id}", albumId).then().statusCode(204);

		auth(token).when().get("/api/v1/trash").then().statusCode(200).body("summary.totalItems", equalTo(3));

		auth(token).when().delete("/api/v1/trash").then().statusCode(204);

		auth(token).when().get("/api/v1/trash").then().statusCode(200).body("items", hasSize(0))
				.body("summary.totalItems", equalTo(0));
	}

	@Test
	void trashIsStrictlyOwnerScoped() throws IOException {
		String owner = registerUserToken("owner");
		String other = registerUserToken("other");
		String photoId = uploadPhoto(owner, "mine.jpg");
		auth(owner).when().delete("/api/v1/photos/{id}", photoId).then().statusCode(204);

		// Another user never sees it, and cannot purge it out from under the owner.
		auth(other).when().get("/api/v1/trash").then().statusCode(200).body("items.id", not(hasItem(photoId)));
		auth(other).contentType(ContentType.JSON).body("{\"items\":[{\"kind\":\"PHOTO\",\"id\":\"" + photoId + "\"}]}")
				.when().post("/api/v1/trash/purge").then().statusCode(204);

		auth(owner).when().get("/api/v1/trash").then().statusCode(200).body("items.id", hasItem(photoId));
	}

	// ── helpers ──────────────────────────────────────────────────────

	private RequestSpecification auth(String token) {
		return given().header("Authorization", "Bearer " + token);
	}

	private String registerUserToken(String suffix) {
		String username = "trash-test-" + suffix + "-" + UUID.randomUUID().toString().substring(0, 8);
		return given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");
	}

	private String uploadPhoto(String token, String filename) throws IOException {
		int nonce = UUID.randomUUID().hashCode();
		Path image = createJpegImage("trash-" + Integer.toHexString(nonce), 40 + (nonce & 31), 40 + ((nonce >> 5) & 31),
				nonce & 0xFFFFFF);
		return auth(token).multiPart("file", filename, Files.readAllBytes(image), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
	}

	private String createAlbum(String token, String name) {
		return auth(token).contentType(ContentType.JSON).body("{\"name\": \"" + name + "\"}").when()
				.post("/api/v1/albums").then().statusCode(201).extract().path("id");
	}

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
}
