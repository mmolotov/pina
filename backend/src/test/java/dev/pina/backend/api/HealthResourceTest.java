package dev.pina.backend.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

@QuarkusTest
class HealthResourceTest {

	@Test
	void healthEndpoint() {
		given().when().get("/api/v1/health").then().statusCode(200).body("status", equalTo("ok"))
				.body("storage.type", equalTo("local")).body("storage.availableBytes", notNullValue());
	}
}
