package dev.pina.backend.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AuthResourceTest {

	@Test
	void registerReturnsTokenAndUser() {
		given().contentType(ContentType.JSON)
				.body("{\"username\":\"reg-test\",\"password\":\"password123\",\"name\":\"Reg User\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).body("accessToken", notNullValue())
				.body("refreshToken", notNullValue()).body("expiresIn", notNullValue())
				.body("user.name", equalTo("Reg User")).body("user.id", notNullValue());
	}

	@Test
	void registerWithoutNameUsesUsername() {
		given().contentType(ContentType.JSON).body("{\"username\":\"nameless\",\"password\":\"password123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).body("user.name", equalTo("nameless"));
	}

	@Test
	void registerDuplicateUsernameReturns409() {
		given().contentType(ContentType.JSON).body("{\"username\":\"dup-user\",\"password\":\"password123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201);

		given().contentType(ContentType.JSON).body("{\"username\":\"dup-user\",\"password\":\"otherpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(409).body("error", equalTo("conflict"));
	}

	@Test
	void registerWithShortPasswordReturns400() {
		given().contentType(ContentType.JSON).body("{\"username\":\"shortpw\",\"password\":\"short\"}").when()
				.post("/api/v1/auth/register").then().statusCode(400);
	}

	@Test
	void registerWithBlankUsernameReturns400() {
		given().contentType(ContentType.JSON).body("{\"username\":\"\",\"password\":\"password123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(400);
	}

	@Test
	void registerWithShortUsernameReturns400() {
		given().contentType(ContentType.JSON).body("{\"username\":\"ab\",\"password\":\"password123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(400);
	}

	@Test
	void loginWithValidCredentials() {
		given().contentType(ContentType.JSON).body("{\"username\":\"login-user\",\"password\":\"password123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201);

		given().contentType(ContentType.JSON).body("{\"username\":\"login-user\",\"password\":\"password123\"}").when()
				.post("/api/v1/auth/login").then().statusCode(200).body("accessToken", notNullValue())
				.body("refreshToken", notNullValue()).body("expiresIn", notNullValue())
				.body("user.name", equalTo("login-user"));
	}

	@Test
	void loginWithWrongPasswordReturns401() {
		given().contentType(ContentType.JSON).body("{\"username\":\"wrong-pw\",\"password\":\"password123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201);

		given().contentType(ContentType.JSON).body("{\"username\":\"wrong-pw\",\"password\":\"wrongpass123\"}").when()
				.post("/api/v1/auth/login").then().statusCode(401).body("error", equalTo("unauthorized"));
	}

	@Test
	void loginWithNonExistentUserReturns401() {
		given().contentType(ContentType.JSON).body("{\"username\":\"ghost\",\"password\":\"password123\"}").when()
				.post("/api/v1/auth/login").then().statusCode(401).body("error", equalTo("unauthorized"));
	}

	@Test
	void meWithValidTokenReturnsUser() {
		String token = given().contentType(ContentType.JSON)
				.body("{\"username\":\"me-user\",\"password\":\"password123\"}").when().post("/api/v1/auth/register")
				.then().statusCode(201).extract().path("accessToken");

		given().header("Authorization", "Bearer " + token).when().get("/api/v1/auth/me").then().statusCode(200)
				.body("name", equalTo("me-user")).body("id", notNullValue());
	}

	@Test
	void meWithoutTokenReturns401() {
		given().when().get("/api/v1/auth/me").then().statusCode(401);
	}

	@Test
	void protectedEndpointWithoutTokenReturns401() {
		given().when().get("/api/v1/photos").then().statusCode(401);
	}

	@Test
	void updateProfileChangesName() {
		String token = given().contentType(ContentType.JSON)
				.body("{\"username\":\"profile-user\",\"password\":\"password123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");

		given().header("Authorization", "Bearer " + token).contentType(ContentType.JSON)
				.body("{\"name\":\"Updated Name\"}").when().put("/api/v1/auth/me").then().statusCode(200)
				.body("name", equalTo("Updated Name"));
	}
}
