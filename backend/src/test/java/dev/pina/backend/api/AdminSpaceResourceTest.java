package dev.pina.backend.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
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
class AdminSpaceResourceTest {

	@Inject
	EntityManager em;

	@Inject
	UserTransaction tx;

	private static RequestSpecification authAs(String token) {
		return given().header("Authorization", "Bearer " + token).contentType(ContentType.JSON);
	}

	private String getAdminToken() throws Exception {
		String username = "admin-space-" + UUID.randomUUID().toString().substring(0, 8);
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
	void listSpacesReturnsPaginatedResults() throws Exception {
		String adminToken = getAdminToken();
		// Create a space first
		authAs(adminToken).body("{\"name\": \"Admin Listed Space\"}").when().post("/api/v1/spaces").then()
				.statusCode(201);

		authAs(adminToken).when().get("/api/v1/admin/spaces?needsTotal=true").then().statusCode(200)
				.body("items", notNullValue()).body("items.size()", greaterThanOrEqualTo(1))
				.body("totalItems", greaterThanOrEqualTo(1));
	}

	@Test
	void getSpaceByIdReturnsDetail() throws Exception {
		String adminToken = getAdminToken();
		String spaceId = authAs(adminToken).body("{\"name\": \"Admin Detail Space\"}").when().post("/api/v1/spaces")
				.then().statusCode(201).extract().path("id");

		authAs(adminToken).when().get("/api/v1/admin/spaces/" + spaceId).then().statusCode(200)
				.body("id", equalTo(spaceId)).body("name", equalTo("Admin Detail Space"))
				.body("creatorName", notNullValue()).body("memberCount", greaterThanOrEqualTo(1));
	}

	@Test
	void getSpaceByIdReturns404ForUnknown() throws Exception {
		String adminToken = getAdminToken();
		authAs(adminToken).when().get("/api/v1/admin/spaces/" + UUID.randomUUID()).then().statusCode(404);
	}

	@Test
	void forceDeleteSpaceReturns204() throws Exception {
		String adminToken = getAdminToken();
		String spaceId = authAs(adminToken).body("{\"name\": \"Space To Delete\"}").when().post("/api/v1/spaces").then()
				.statusCode(201).extract().path("id");

		authAs(adminToken).when().delete("/api/v1/admin/spaces/" + spaceId).then().statusCode(204);
		authAs(adminToken).when().get("/api/v1/admin/spaces/" + spaceId).then().statusCode(404);
	}

	@Test
	void forceDeleteUnknownSpaceReturns404() throws Exception {
		String adminToken = getAdminToken();
		authAs(adminToken).when().delete("/api/v1/admin/spaces/" + UUID.randomUUID()).then().statusCode(404);
	}

	@Test
	void nonAdminGetsForbidden() {
		String username = "non-admin-space-" + UUID.randomUUID().toString().substring(0, 8);
		String token = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");

		String role = authAs(token).when().get("/api/v1/auth/me").then().extract().path("instanceRole");
		if ("ADMIN".equals(role)) {
			username = "non-admin-space-b-" + UUID.randomUUID().toString().substring(0, 8);
			token = given().contentType(ContentType.JSON)
					.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
					.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");
		}

		authAs(token).when().get("/api/v1/admin/spaces").then().statusCode(403);
	}
}
