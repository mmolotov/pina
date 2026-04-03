package dev.pina.backend.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.restassured.http.ContentType;
import java.util.UUID;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(AuthRateLimitTestProfile.class)
class AuthRateLimitResourceTest {

	@Test
	void throttlesRepeatedSessionLoginAttemptsFromSameClient() {
		String username = "session-limit-" + UUID.randomUUID().toString().substring(0, 8);
		String clientIp = "198.51.100.77";
		given().header("X-Forwarded-For", clientIp).contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"password123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201);

		for (int attempt = 0; attempt < 2; attempt++) {
			given().header("X-Forwarded-For", clientIp).contentType(ContentType.JSON)
					.body("{\"username\":\"" + username + "\",\"password\":\"password123\"}").when()
					.post("/api/v1/auth/session/login").then().statusCode(200).body("id", notNullValue());
		}

		given().header("X-Forwarded-For", clientIp).contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"password123\"}").when()
				.post("/api/v1/auth/session/login").then().statusCode(429).body("error", equalTo("too_many_requests"))
				.header("Retry-After", notNullValue());
	}
}
