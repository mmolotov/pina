package dev.pina.backend.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.when;

import dev.pina.backend.service.ExifExtractor;
import io.quarkus.test.InjectMock;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class PhotoGeoResourceTest {

	@InjectMock
	ExifExtractor exifExtractor;

	@BeforeEach
	void resetMocks() {
		reset(exifExtractor);
	}

	@Test
	void uploadReturnsLatitudeAndLongitudeFromExif() throws IOException {
		String token = registerUserToken("geo-upload");
		Path image = createJpegImage("geo-upload", 120, 80, 0x336699);

		when(exifExtractor.extract(any(Path.class)))
				.thenReturn(new ExifExtractor.ExifResult("{\"latitude\":44.7866,\"longitude\":20.4489}",
						OffsetDateTime.parse("2024-02-03T10:15:30Z"), 44.7866, 20.4489));

		authAs(token).multiPart("file", image.toFile(), "image/jpeg").when().post("/api/v1/photos").then()
				.statusCode(201).body("latitude", equalTo(44.7866f)).body("longitude", equalTo(20.4489f))
				.body("exifData",
						allOf(containsString("\"latitude\":44.7866"), containsString("\"longitude\":20.4489")));
	}

	@Test
	void boundingBoxReturnsOnlyPhotosInsideRectangle() throws IOException {
		String token = registerUserToken("geo-bbox");
		Path insideImage = createJpegImage("geo-bbox-inside", 100, 100, 0x114477);
		Path outsideImage = createJpegImage("geo-bbox-outside", 100, 100, 0x771144);

		when(exifExtractor.extract(any(Path.class))).thenReturn(
				new ExifExtractor.ExifResult("{\"latitude\":44.8176,\"longitude\":20.4633}", null, 44.8176, 20.4633),
				new ExifExtractor.ExifResult("{\"latitude\":48.8566,\"longitude\":2.3522}", null, 48.8566, 2.3522));

		String insideId = authAs(token).multiPart("file", insideImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
		String outsideId = authAs(token).multiPart("file", outsideImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");

		authAs(token).when().get("/api/v1/photos/geo?swLat=44.70&swLng=20.30&neLat=44.90&neLng=20.60").then()
				.statusCode(200).body("items", hasSize(1)).body("items.id", hasItems(insideId))
				.body("items.id", not(hasItems(outsideId)));
	}

	@Test
	void nearbyReturnsOnlyPhotosWithinRequestedRadius() throws IOException {
		String token = registerUserToken("geo-nearby");
		Path nearbyImage = createJpegImage("geo-nearby-inside", 100, 100, 0x225522);
		Path farButInsideBoundingBoxImage = createJpegImage("geo-nearby-corner", 100, 100, 0x552222);

		when(exifExtractor.extract(any(Path.class))).thenReturn(
				new ExifExtractor.ExifResult("{\"latitude\":44.7900,\"longitude\":20.4500}", null, 44.7900, 20.4500),
				new ExifExtractor.ExifResult("{\"latitude\":44.8240,\"longitude\":20.4920}", null, 44.8240, 20.4920));

		String nearbyId = authAs(token).multiPart("file", nearbyImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
		String farId = authAs(token).multiPart("file", farButInsideBoundingBoxImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");

		authAs(token).when().get("/api/v1/photos/geo/nearby?lat=44.7866&lng=20.4489&radiusKm=5").then().statusCode(200)
				.body("items", hasSize(1)).body("items.id", hasItems(nearbyId)).body("items.id", not(hasItems(farId)));
	}

	@Test
	void nearbyOrdersResultsByActualDistance() throws IOException {
		String token = registerUserToken("geo-nearby-order");
		Path closestImage = createJpegImage("geo-nearby-closest", 100, 100, 0x225522);
		Path middleImage = createJpegImage("geo-nearby-middle", 100, 100, 0x335533);
		Path farthestImage = createJpegImage("geo-nearby-farthest", 100, 100, 0x445544);

		when(exifExtractor.extract(any(Path.class))).thenReturn(
				new ExifExtractor.ExifResult(
						"{\"takenAt\":\"2024-01-03T10:15:30Z\",\"latitude\":44.7868,\"longitude\":20.4490}",
						OffsetDateTime.parse("2024-01-03T10:15:30Z"), 44.7868, 20.4490),
				new ExifExtractor.ExifResult(
						"{\"takenAt\":\"2024-01-02T10:15:30Z\",\"latitude\":44.7920,\"longitude\":20.4530}",
						OffsetDateTime.parse("2024-01-02T10:15:30Z"), 44.7920, 20.4530),
				new ExifExtractor.ExifResult(
						"{\"takenAt\":\"2024-01-04T10:15:30Z\",\"latitude\":44.7990,\"longitude\":20.4580}",
						OffsetDateTime.parse("2024-01-04T10:15:30Z"), 44.7990, 20.4580));

		String closestId = authAs(token).multiPart("file", closestImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
		String middleId = authAs(token).multiPart("file", middleImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
		String farthestId = authAs(token).multiPart("file", farthestImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");

		authAs(token).when().get("/api/v1/photos/geo/nearby?lat=44.7866&lng=20.4489&radiusKm=5").then().statusCode(200)
				.body("items.id", contains(closestId, middleId, farthestId));
	}

	@Test
	void geoQueriesExcludePhotosWithoutGpsCoordinates() throws IOException {
		String token = registerUserToken("geo-null");
		Path withoutGpsImage = createJpegImage("geo-null-without", 100, 100, 0x222255);
		Path withGpsImage = createJpegImage("geo-null-with", 100, 100, 0x225555);

		when(exifExtractor.extract(any(Path.class))).thenReturn(new ExifExtractor.ExifResult(null, null, null, null),
				new ExifExtractor.ExifResult("{\"latitude\":44.8176,\"longitude\":20.4633}", null, 44.8176, 20.4633));

		String withoutGpsId = authAs(token).multiPart("file", withoutGpsImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
		String withGpsId = authAs(token).multiPart("file", withGpsImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");

		authAs(token).when().get("/api/v1/photos/geo?swLat=44.70&swLng=20.30&neLat=44.90&neLng=20.60").then()
				.statusCode(200).body("items", hasSize(1)).body("items.id", hasItems(withGpsId))
				.body("items.id", not(hasItems(withoutGpsId)));
	}

	@Test
	void geoRejectsBoundingBoxWithInvertedLatitudes() {
		String token = registerUserToken("geo-invalid-bbox");

		authAs(token).when().get("/api/v1/photos/geo?swLat=45.0&swLng=20.0&neLat=44.0&neLng=21.0").then()
				.statusCode(400).body("error", equalTo("bad_request"))
				.body("message", equalTo("swLat must be less than or equal to neLat"));
	}

	@Test
	void geoRejectsNonFiniteBoundingBoxCoordinates() {
		String token = registerUserToken("geo-invalid-finite");

		authAs(token).when().get("/api/v1/photos/geo?swLat=NaN&swLng=20.0&neLat=44.0&neLng=21.0").then().statusCode(400)
				.body("error", equalTo("bad_request"))
				.body("message", equalTo("Geo coordinates must be finite numbers"));
	}

	@Test
	void nearbyAtPoleSearchesAcrossAllLongitudes() throws IOException {
		String token = registerUserToken("geo-pole");
		Path polarImage = createJpegImage("geo-pole-inside", 100, 100, 0x4444aa);
		Path outsideImage = createJpegImage("geo-pole-outside", 100, 100, 0xaa4444);

		when(exifExtractor.extract(any(Path.class))).thenReturn(
				new ExifExtractor.ExifResult("{\"latitude\":89.95,\"longitude\":-135.0}", null, 89.95, -135.0),
				new ExifExtractor.ExifResult("{\"latitude\":88.0,\"longitude\":45.0}", null, 88.0, 45.0));

		String polarId = authAs(token).multiPart("file", polarImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");
		String outsideId = authAs(token).multiPart("file", outsideImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");

		authAs(token).when().get("/api/v1/photos/geo/nearby?lat=90&lng=0&radiusKm=10").then().statusCode(200)
				.body("items", hasSize(1)).body("items.id", hasItems(polarId))
				.body("items.id", not(hasItems(outsideId)));
	}

	@Test
	void nearbyRejectsNonFiniteCoordinatesAndRadius() {
		String token = registerUserToken("geo-nearby-invalid");

		authAs(token).when().get("/api/v1/photos/geo/nearby?lat=NaN&lng=20.0&radiusKm=10").then().statusCode(400)
				.body("error", equalTo("bad_request"))
				.body("message", equalTo("Geo coordinates and radiusKm must be finite numbers"));

		authAs(token).when().get("/api/v1/photos/geo/nearby?lat=44.0&lng=20.0&radiusKm=Infinity").then().statusCode(400)
				.body("error", equalTo("bad_request"))
				.body("message", equalTo("Geo coordinates and radiusKm must be finite numbers"));
	}

	@Test
	void boundingBoxCrossingAntimeridianReturnsPhotosOnBothSides() throws IOException {
		String token = registerUserToken("geo-dateline");
		Path eastImage = createJpegImage("geo-dateline-east", 100, 100, 0x118844);
		Path westImage = createJpegImage("geo-dateline-west", 100, 100, 0x441188);
		Path outsideImage = createJpegImage("geo-dateline-outside", 100, 100, 0x884411);

		when(exifExtractor.extract(any(Path.class))).thenReturn(
				new ExifExtractor.ExifResult("{\"latitude\":10.0,\"longitude\":179.5}", null, 10.0, 179.5),
				new ExifExtractor.ExifResult("{\"latitude\":10.0,\"longitude\":-179.5}", null, 10.0, -179.5),
				new ExifExtractor.ExifResult("{\"latitude\":10.0,\"longitude\":-160.0}", null, 10.0, -160.0));

		String eastId = authAs(token).multiPart("file", eastImage.toFile(), "image/jpeg").when().post("/api/v1/photos")
				.then().statusCode(201).extract().path("id");
		String westId = authAs(token).multiPart("file", westImage.toFile(), "image/jpeg").when().post("/api/v1/photos")
				.then().statusCode(201).extract().path("id");
		String outsideId = authAs(token).multiPart("file", outsideImage.toFile(), "image/jpeg").when()
				.post("/api/v1/photos").then().statusCode(201).extract().path("id");

		authAs(token).when().get("/api/v1/photos/geo?swLat=9&swLng=170&neLat=11&neLng=-170").then().statusCode(200)
				.body("items", hasSize(2)).body("items.id", hasItems(eastId, westId))
				.body("items.id", not(hasItems(outsideId)));
	}

	@Test
	void geoListUsesMarkerPayloadWithoutExifOrVariants() throws IOException {
		String token = registerUserToken("geo-marker-payload");
		Path image = createJpegImage("geo-marker", 100, 100, 0x118844);

		when(exifExtractor.extract(any(Path.class))).thenReturn(
				new ExifExtractor.ExifResult("{\"latitude\":44.8176,\"longitude\":20.4633,\"camera\":\"demo\"}",
						OffsetDateTime.parse("2024-02-03T10:15:30Z"), 44.8176, 20.4633));

		authAs(token).multiPart("file", image.toFile(), "image/jpeg").when().post("/api/v1/photos").then()
				.statusCode(201);

		authAs(token).when().get("/api/v1/photos/geo?swLat=44.70&swLng=20.30&neLat=44.90&neLng=20.60").then()
				.statusCode(200).body("items", hasSize(1)).body("items[0].exifData", equalTo(null))
				.body("items[0].variants", hasSize(0)).body("items[0].personalLibraryId", notNullValue());
	}

	private static Path createJpegImage(String prefix, int width, int height, int rgb) throws IOException {
		Path image = Files.createTempFile(prefix, ".jpg");
		BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
		var g = img.createGraphics();
		g.setColor(new java.awt.Color(rgb));
		g.fillRect(0, 0, width, height);
		g.dispose();
		ImageIO.write(img, "jpg", image.toFile());
		return image;
	}

	private static String registerUserToken(String suffix) {
		String username = "photo-geo-" + suffix + "-" + UUID.randomUUID().toString().substring(0, 8);
		return given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");
	}

	private static RequestSpecification authAs(String token) {
		return given().header("Authorization", "Bearer " + token);
	}
}
