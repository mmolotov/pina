package dev.pina.backend.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import java.util.UUID;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AuthRefreshTokenTest {

	@Test
	void loginReturnsRefreshToken() {
		var username = "refresh-login-" + UUID.randomUUID().toString().substring(0, 8);
		given().contentType(ContentType.JSON).body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}")
				.when().post("/api/v1/auth/register").then().statusCode(201);

		given().contentType(ContentType.JSON).body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}")
				.when().post("/api/v1/auth/login").then().statusCode(200).body("accessToken", notNullValue())
				.body("refreshToken", notNullValue()).body("expiresIn", equalTo(900));
	}

	@Test
	void refreshReturnsNewTokenPair() {
		var username = "refresh-pair-" + UUID.randomUUID().toString().substring(0, 8);
		var response = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract();

		String refreshToken = response.path("refreshToken");

		given().contentType(ContentType.JSON).body("{\"refreshToken\":\"" + refreshToken + "\"}").when()
				.post("/api/v1/auth/refresh").then().statusCode(200).body("accessToken", notNullValue())
				.body("refreshToken", notNullValue()).body("expiresIn", equalTo(900)).body("user", notNullValue());
	}

	@Test
	void refreshRotatesToken() {
		var username = "refresh-rotate-" + UUID.randomUUID().toString().substring(0, 8);
		String refreshToken1 = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("refreshToken");

		String refreshToken2 = given().contentType(ContentType.JSON)
				.body("{\"refreshToken\":\"" + refreshToken1 + "\"}").when().post("/api/v1/auth/refresh").then()
				.statusCode(200).extract().path("refreshToken");

		assertNotEquals(refreshToken1, refreshToken2);
	}

	@Test
	void oldRefreshTokenInvalidAfterRotation() {
		var username = "refresh-old-" + UUID.randomUUID().toString().substring(0, 8);
		String refreshToken = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("refreshToken");

		// Use it once (rotates)
		given().contentType(ContentType.JSON).body("{\"refreshToken\":\"" + refreshToken + "\"}").when()
				.post("/api/v1/auth/refresh").then().statusCode(200);

		// Try again with old token — should fail
		given().contentType(ContentType.JSON).body("{\"refreshToken\":\"" + refreshToken + "\"}").when()
				.post("/api/v1/auth/refresh").then().statusCode(401);
	}

	@Test
	void invalidRefreshTokenReturns401() {
		given().contentType(ContentType.JSON).body("{\"refreshToken\":\"not-a-real-token\"}").when()
				.post("/api/v1/auth/refresh").then().statusCode(401);
	}

	@Test
	void logoutRevokesRefreshToken() {
		var username = "refresh-logout-" + UUID.randomUUID().toString().substring(0, 8);
		String refreshToken = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("refreshToken");

		given().contentType(ContentType.JSON).body("{\"refreshToken\":\"" + refreshToken + "\"}").when()
				.post("/api/v1/auth/logout").then().statusCode(204);

		// Refresh with revoked token fails
		given().contentType(ContentType.JSON).body("{\"refreshToken\":\"" + refreshToken + "\"}").when()
				.post("/api/v1/auth/refresh").then().statusCode(401);
	}

	@Test
	void logoutWithInvalidTokenReturns204() {
		// Logout is idempotent — no error for unknown tokens
		given().contentType(ContentType.JSON).body("{\"refreshToken\":\"nonexistent-token\"}").when()
				.post("/api/v1/auth/logout").then().statusCode(204);
	}

	@Test
	void newAccessTokenWorksAfterRefresh() {
		var username = "refresh-access-" + UUID.randomUUID().toString().substring(0, 8);
		String refreshToken = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("refreshToken");

		String newAccessToken = given().contentType(ContentType.JSON)
				.body("{\"refreshToken\":\"" + refreshToken + "\"}").when().post("/api/v1/auth/refresh").then()
				.statusCode(200).extract().path("accessToken");

		given().header("Authorization", "Bearer " + newAccessToken).when().get("/api/v1/auth/me").then().statusCode(200)
				.body("name", notNullValue());
	}
}
