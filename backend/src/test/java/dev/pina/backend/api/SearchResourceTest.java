package dev.pina.backend.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.UserTransaction;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

@QuarkusTest
class SearchResourceTest {

	@Inject
	EntityManager em;

	@Inject
	UserTransaction tx;

	private static String registerUser(String suffix) {
		String username = "search-test-" + suffix + "-" + UUID.randomUUID().toString().substring(0, 8);
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
		Path image = createJpegImage(filename);
		return UUID.fromString(
				given().header("Authorization", "Bearer " + token).multiPart("file", image.toFile(), "image/jpeg")
						.when().post("/api/v1/photos").then().statusCode(201).extract().path("id"));
	}

	private static Path createJpegImage(String filename) throws IOException {
		Path dir = Files.createTempDirectory("search-test-image");
		Path image = dir.resolve(filename);
		BufferedImage img = new BufferedImage(50, 50, BufferedImage.TYPE_INT_RGB);
		var g = img.createGraphics();
		g.setColor(new java.awt.Color(UUID.randomUUID().hashCode() & 0xFFFFFF));
		g.fillRect(0, 0, 50, 50);
		g.dispose();
		ImageIO.write(img, "jpg", image.toFile());
		return image;
	}

	private static String jsonString(String value) {
		return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r")
				.replace("\t", "\\t") + "\"";
	}

	private static UUID createAlbum(String token, String name, String description) {
		String payload = description == null
				? "{\"name\":" + jsonString(name) + "}"
				: "{\"name\":" + jsonString(name) + ",\"description\":" + jsonString(description) + "}";
		return UUID.fromString(
				authAs(token).body(payload).when().post("/api/v1/albums").then().statusCode(201).extract().path("id"));
	}

	private static UUID createSpace(String token, String name) {
		return UUID.fromString(authAs(token).body("{\"name\":" + jsonString(name) + "}").when().post("/api/v1/spaces")
				.then().statusCode(201).extract().path("id"));
	}

	private static UUID createSpaceAlbum(String token, UUID spaceId, String name, String description) {
		String payload = description == null
				? "{\"name\":" + jsonString(name) + "}"
				: "{\"name\":" + jsonString(name) + ",\"description\":" + jsonString(description) + "}";
		return UUID.fromString(authAs(token).body(payload).when().post("/api/v1/spaces/" + spaceId + "/albums").then()
				.statusCode(201).extract().path("id"));
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

	private static void addPhotoFavorite(String token, UUID photoId) {
		authAs(token).body("{\"targetType\":\"PHOTO\",\"targetId\":\"" + photoId + "\"}").when()
				.post("/api/v1/favorites").then().statusCode(201);
	}

	private static void addAlbumFavorite(String token, UUID albumId) {
		authAs(token).body("{\"targetType\":\"ALBUM\",\"targetId\":\"" + albumId + "\"}").when()
				.post("/api/v1/favorites").then().statusCode(201);
	}

	private void setAlbumUpdatedAt(UUID albumId, OffsetDateTime updatedAt) throws Exception {
		tx.begin();
		em.createQuery("UPDATE Album a SET a.updatedAt = :updatedAt WHERE a.id = :id")
				.setParameter("updatedAt", updatedAt).setParameter("id", albumId).executeUpdate();
		tx.commit();
	}

	@Test
	void searchAllScopeReturnsMixedLibraryResults() throws Exception {
		String token = registerUser("mixed");
		uploadPhoto(token, "harbor-memory.jpg");
		createAlbum(token, "Harbor Notes", "Collected harbor references");

		authAs(token).when().get("/api/v1/search?q=harbor&needsTotal=true").then().statusCode(200)
				.body("items", hasSize(2)).body("items.kind", containsInAnyOrder("ALBUM", "PHOTO"))
				.body("items.entryScope", containsInAnyOrder("LIBRARY", "LIBRARY")).body("totalItems", equalTo(2))
				.body("totalPages", equalTo(1));
	}

	@Test
	void searchRespectsSpaceAccessControlAndIncludesSpaceContext() throws Exception {
		String ownerToken = registerUser("space-owner");
		String memberToken = registerUser("space-member");
		String outsiderToken = registerUser("space-outsider");
		UUID spaceId = createSpace(ownerToken, "Search Access Space");
		addMember(ownerToken, spaceId, memberToken, "VIEWER");

		UUID photoId = uploadPhoto(ownerToken, "shared-beacon.jpg");
		UUID albumId = createSpaceAlbum(ownerToken, spaceId, "Shared Beacon Album", "Visible in space");
		addPhotoToSpaceAlbum(ownerToken, spaceId, albumId, photoId);

		authAs(memberToken).when().get("/api/v1/search?q=beacon&scope=spaces").then().statusCode(200)
				.body("items", hasSize(2)).body("items.kind", containsInAnyOrder("ALBUM", "PHOTO"))
				.body("items.find { it.kind == 'PHOTO' }.entryScope", equalTo("SPACES"))
				.body("items.find { it.kind == 'PHOTO' }.photo.spaceId", equalTo(spaceId.toString()))
				.body("items.find { it.kind == 'PHOTO' }.photo.albumId", equalTo(albumId.toString()))
				.body("items.find { it.kind == 'PHOTO' }.photo.spaceName", equalTo("Search Access Space"));

		authAs(outsiderToken).when().get("/api/v1/search?q=beacon&scope=spaces&needsTotal=true").then().statusCode(200)
				.body("items", hasSize(0)).body("totalItems", equalTo(0));
	}

	@Test
	void searchPreservesSpaceContextForOwnerVisibleSharedPhotos() throws Exception {
		String ownerToken = registerUser("space-owner-context");
		UUID spaceId = createSpace(ownerToken, "Owner Search Space");
		UUID photoId = uploadPhoto(ownerToken, "owner-shared-beacon.jpg");
		UUID albumId = createSpaceAlbum(ownerToken, spaceId, "Owner Shared Album", "Owner-visible shared album");
		addPhotoToSpaceAlbum(ownerToken, spaceId, albumId, photoId);
		addPhotoFavorite(ownerToken, photoId);

		authAs(ownerToken).when().get("/api/v1/search?q=beacon&scope=spaces&kind=photo").then().statusCode(200)
				.body("items", hasSize(1)).body("items[0].entryScope", equalTo("SPACES"))
				.body("items[0].photo.spaceId", equalTo(spaceId.toString()))
				.body("items[0].photo.albumId", equalTo(albumId.toString()));

		authAs(ownerToken).when().get("/api/v1/search?q=beacon&scope=all&kind=photo").then().statusCode(200)
				.body("items", hasSize(1)).body("items[0].entryScope", equalTo("LIBRARY"))
				.body("items[0].photo.spaceId", equalTo(spaceId.toString()))
				.body("items[0].photo.albumId", equalTo(albumId.toString()));

		authAs(ownerToken).when().get("/api/v1/search?q=beacon&scope=favorites&kind=photo").then().statusCode(200)
				.body("items", hasSize(1)).body("items[0].entryScope", equalTo("SPACES"))
				.body("items[0].favorited", equalTo(true)).body("items[0].photo.spaceId", equalTo(spaceId.toString()))
				.body("items[0].photo.albumId", equalTo(albumId.toString()));
	}

	@Test
	void searchFavoritesScopeReturnsOnlyFavoritedVisibleResults() throws Exception {
		String token = registerUser("favorites");
		UUID favoritePhotoId = uploadPhoto(token, "favorite-skyline.jpg");
		uploadPhoto(token, "favorite-archive.jpg");
		UUID favoriteAlbumId = createAlbum(token, "Favorite Skyline Album", "favorite-only");
		createAlbum(token, "Favorite Draft Album", "favorite-only");

		addPhotoFavorite(token, favoritePhotoId);
		addAlbumFavorite(token, favoriteAlbumId);

		authAs(token).when().get("/api/v1/search?q=favorite&scope=favorites&needsTotal=true").then().statusCode(200)
				.body("items", hasSize(2)).body("items.favorited", containsInAnyOrder(true, true))
				.body("items.kind", containsInAnyOrder("ALBUM", "PHOTO")).body("totalItems", equalTo(2));
		authAs(token).when().get("/api/v1/search?q=archive&scope=favorites").then().statusCode(200).body("items",
				hasSize(0));
		authAs(token).when().get("/api/v1/search?q=draft&scope=favorites").then().statusCode(200).body("items",
				hasSize(0));
		authAs(token).when().get("/api/v1/search?q=skyline&scope=favorites&kind=photo").then().statusCode(200)
				.body("items", hasSize(1)).body("items[0].photo.photo.id", equalTo(favoritePhotoId.toString()));
	}

	@Test
	void searchSupportsPaginationRelevanceAndKindFiltering() throws Exception {
		String token = registerUser("paging");
		UUID exactPhotoId = uploadPhoto(token, "beach.jpg");
		uploadPhoto(token, "trip-beach.jpg");
		createAlbum(token, "Beach album", "beach notes");

		authAs(token).when().get("/api/v1/search?q=beach.jpg&kind=photo&needsTotal=true&size=1").then().statusCode(200)
				.body("items", hasSize(1)).body("items[0].kind", equalTo("PHOTO"))
				.body("items[0].photo.photo.id", equalTo(exactPhotoId.toString())).body("hasNext", equalTo(true))
				.body("totalItems", equalTo(2));

		authAs(token).when().get("/api/v1/search?q=beach&kind=album").then().statusCode(200).body("items", hasSize(1))
				.body("items[0].kind", equalTo("ALBUM"));
	}

	@Test
	void searchTreatsLikeWildcardsAndEscapeCharactersAsLiteralText() throws Exception {
		String token = registerUser("literal-like");
		uploadPhoto(token, "IMG_1234.jpg");
		uploadPhoto(token, "IMGX1234.jpg");
		createAlbum(token, "Budget 100% Ready", "literal percent");
		createAlbum(token, "Budget 1000 Ready", "control");
		createAlbum(token, "folder\\name", "literal backslash");
		createAlbum(token, "foldername", "control");

		authAs(token).queryParam("q", "IMG_1234").queryParam("kind", "photo").when().get("/api/v1/search").then()
				.statusCode(200).body("items", hasSize(1))
				.body("items[0].photo.photo.originalFilename", equalTo("IMG_1234.jpg"));

		authAs(token).queryParam("q", "100%").queryParam("kind", "album").when().get("/api/v1/search").then()
				.statusCode(200).body("items", hasSize(1))
				.body("items[0].album.album.name", equalTo("Budget 100% Ready"));

		authAs(token).queryParam("q", "folder\\name").queryParam("kind", "album").when().get("/api/v1/search").then()
				.statusCode(200).body("items", hasSize(1)).body("items[0].album.album.name", equalTo("folder\\name"));
	}

	@Test
	void searchKeepsInjectionShapedInputParameterized() {
		String token = registerUser("injection-like");
		String injectionLikeQuery = "%' OR 1=1 --";
		createAlbum(token, injectionLikeQuery, "literal text");
		createAlbum(token, "ordinary album", "control");

		authAs(token).queryParam("q", injectionLikeQuery).queryParam("kind", "album").queryParam("needsTotal", true)
				.when().get("/api/v1/search").then().statusCode(200).body("items", hasSize(1))
				.body("items[0].album.album.name", equalTo(injectionLikeQuery)).body("totalItems", equalTo(1));
	}

	@Test
	void searchSupportsNewestAndOldestSortForAlbums() throws Exception {
		String token = registerUser("sort");
		UUID olderAlbumId = createAlbum(token, "Sort match older", "sorting");
		UUID newerAlbumId = createAlbum(token, "Sort match newer", "sorting");
		setAlbumUpdatedAt(olderAlbumId, OffsetDateTime.parse("2026-04-01T10:00:00Z"));
		setAlbumUpdatedAt(newerAlbumId, OffsetDateTime.parse("2026-04-05T10:00:00Z"));

		authAs(token).when().get("/api/v1/search?q=sort&kind=album&sort=newest").then().statusCode(200)
				.body("items", hasSize(2)).body("items[0].album.album.id", equalTo(newerAlbumId.toString()))
				.body("items[1].album.album.id", equalTo(olderAlbumId.toString()));

		authAs(token).when().get("/api/v1/search?q=sort&kind=album&sort=oldest").then().statusCode(200)
				.body("items", hasSize(2)).body("items[0].album.album.id", equalTo(olderAlbumId.toString()))
				.body("items[1].album.album.id", equalTo(newerAlbumId.toString()));
	}

	@Test
	void searchRejectsInvalidScopeKindAndSort() {
		String token = registerUser("invalid");

		authAs(token).when().get("/api/v1/search?q=test&scope=nope").then().statusCode(400).body("error",
				equalTo("bad_request"));
		authAs(token).when().get("/api/v1/search?q=test&kind=video").then().statusCode(400).body("error",
				equalTo("bad_request"));
		authAs(token).when().get("/api/v1/search?q=test&sort=random").then().statusCode(400).body("error",
				equalTo("bad_request"));
	}

	@Test
	void emptyQueryReturnsStableEmptyPage() {
		String token = registerUser("empty");

		authAs(token).when().get("/api/v1/search?needsTotal=true").then().statusCode(200).body("items", hasSize(0))
				.body("page", equalTo(0)).body("size", equalTo(50)).body("hasNext", equalTo(false))
				.body("totalItems", equalTo(0)).body("totalPages", equalTo(0));
	}
}
