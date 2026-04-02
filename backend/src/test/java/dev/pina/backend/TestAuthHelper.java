package dev.pina.backend;

import static io.restassured.RestAssured.given;

import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import java.util.UUID;

/**
 * Provides authenticated REST Assured requests for resource-level tests. Lazily
 * registers a test user and caches the JWT token.
 */
public final class TestAuthHelper {

	private static String cachedToken;

	private TestAuthHelper() {
	}

	public static synchronized String getToken() {
		if (cachedToken == null) {
			String username = "testuser-" + UUID.randomUUID().toString().substring(0, 8);
			cachedToken = given().contentType(ContentType.JSON)
					.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
					.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");
		}
		return cachedToken;
	}

	public static RequestSpecification authenticated() {
		return given().header("Authorization", "Bearer " + getToken());
	}
}
