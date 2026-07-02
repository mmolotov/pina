package dev.pina.backend.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
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
class AdminOverviewResourceTest {

	@Inject
	EntityManager em;

	@Inject
	UserTransaction tx;

	private static RequestSpecification authAs(String token) {
		return given().header("Authorization", "Bearer " + token).contentType(ContentType.JSON);
	}

	private String getAdminToken() throws Exception {
		String username = "admin-overview-" + UUID.randomUUID().toString().substring(0, 8);
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
	void overviewReturnsAggregateSnapshot() throws Exception {
		String adminToken = getAdminToken();
		authAs(adminToken).when().get("/api/v1/admin/overview").then().statusCode(200)
				.body("totalUsers", greaterThanOrEqualTo(1)).body("adminUsers", greaterThanOrEqualTo(1))
				.body("totalSpaces", notNullValue()).body("activeInvites", notNullValue())
				.body("totalPhotos", notNullValue()).body("storageProvider", notNullValue())
				.body("status", notNullValue()).body("version", notNullValue())
				.body("databaseConnected", notNullValue()).body("jvmHeapMaxBytes", greaterThanOrEqualTo(1));
	}

	@Test
	void nonAdminGetsForbidden() {
		String username = "non-admin-overview-" + UUID.randomUUID().toString().substring(0, 8);
		String token = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");

		String role = authAs(token).when().get("/api/v1/auth/me").then().extract().path("instanceRole");
		if ("ADMIN".equals(role)) {
			username = "non-admin-overview-b-" + UUID.randomUUID().toString().substring(0, 8);
			token = given().contentType(ContentType.JSON)
					.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
					.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");
		}

		authAs(token).when().get("/api/v1/admin/overview").then().statusCode(403);
	}
}
