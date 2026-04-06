package dev.pina.backend.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;

import dev.pina.backend.domain.InstanceRole;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.UserTransaction;
import java.util.UUID;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AdminSettingsResourceTest {

	@Inject
	EntityManager em;

	@Inject
	UserTransaction tx;

	private static RequestSpecification authAs(String token) {
		return given().header("Authorization", "Bearer " + token).contentType(ContentType.JSON);
	}

	private String getAdminToken() throws Exception {
		String username = "admin-settings-" + UUID.randomUUID().toString().substring(0, 8);
		String password = "testpass123";
		given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201);

		String token = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}").when()
				.post("/api/v1/auth/login").then().statusCode(200).extract().path("accessToken");
		String userId = authAs(token).when().get("/api/v1/auth/me").then().statusCode(200).extract().path("id");

		tx.begin();
		em.createQuery("UPDATE User u SET u.instanceRole = :role WHERE u.id = :id")
				.setParameter("role", InstanceRole.ADMIN).setParameter("id", UUID.fromString(userId)).executeUpdate();
		tx.commit();

		return given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}").when()
				.post("/api/v1/auth/login").then().statusCode(200).extract().path("accessToken");
	}

	@Test
	void getSettingsReturnsDefaults() throws Exception {
		String adminToken = getAdminToken();
		authAs(adminToken).when().get("/api/v1/admin/settings").then().statusCode(200)
				.body("registrationMode", notNullValue()).body("compressionFormat", notNullValue())
				.body("compressionQuality", notNullValue()).body("compressionMaxResolution", notNullValue());
	}

	@Test
	void updateSettingsWorks() throws Exception {
		String adminToken = getAdminToken();
		authAs(adminToken).body("{\"compressionQuality\": 90}").when().put("/api/v1/admin/settings").then()
				.statusCode(200).body("compressionQuality", equalTo(90));

		// Reset to default
		authAs(adminToken).body("{\"compressionQuality\": 82}").when().put("/api/v1/admin/settings").then()
				.statusCode(200);
	}

	@Test
	void updateSettingsRejectsInvalidFormat() throws Exception {
		String adminToken = getAdminToken();
		authAs(adminToken).body("{\"compressionFormat\": \"bmp\"}").when().put("/api/v1/admin/settings").then()
				.statusCode(400);
	}

	@Test
	void updateSettingsRejectsInvalidQuality() throws Exception {
		String adminToken = getAdminToken();
		authAs(adminToken).body("{\"compressionQuality\": 101}").when().put("/api/v1/admin/settings").then()
				.statusCode(400);
	}

	@Test
	void updateSettingsRejectsInvalidRegistrationMode() throws Exception {
		String adminToken = getAdminToken();
		authAs(adminToken).body("{\"registrationMode\": \"INVALID\"}").when().put("/api/v1/admin/settings").then()
				.statusCode(400);
	}

	@Test
	void registrationClosedBlocksNewUsers() throws Exception {
		String adminToken = getAdminToken();

		// Set registration to CLOSED
		authAs(adminToken).body("{\"registrationMode\": \"CLOSED\"}").when().put("/api/v1/admin/settings").then()
				.statusCode(200);

		try {
			// Attempt to register new user
			String username = "closed-reg-" + UUID.randomUUID().toString().substring(0, 8);
			given().contentType(ContentType.JSON)
					.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
					.post("/api/v1/auth/register").then().statusCode(403);
		} finally {
			// Reset to OPEN
			authAs(adminToken).body("{\"registrationMode\": \"OPEN\"}").when().put("/api/v1/admin/settings").then()
					.statusCode(200);
		}
	}

	@Test
	void nonAdminGetsForbidden() {
		String username = "non-admin-settings-" + UUID.randomUUID().toString().substring(0, 8);
		String token = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");

		String role = authAs(token).when().get("/api/v1/auth/me").then().extract().path("instanceRole");
		if ("ADMIN".equals(role)) {
			username = "non-admin-settings-b-" + UUID.randomUUID().toString().substring(0, 8);
			token = given().contentType(ContentType.JSON)
					.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
					.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");
		}

		authAs(token).when().get("/api/v1/admin/settings").then().statusCode(403);
	}
}
