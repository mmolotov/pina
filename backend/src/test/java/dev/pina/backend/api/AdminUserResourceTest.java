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
class AdminUserResourceTest {

	@Inject
	EntityManager em;

	@Inject
	UserTransaction tx;

	private static String registerUser(String suffix) {
		String username = "admin-user-" + suffix + "-" + UUID.randomUUID().toString().substring(0, 8);
		return given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");
	}

	private static RequestSpecification authAs(String token) {
		return given().header("Authorization", "Bearer " + token).contentType(ContentType.JSON);
	}

	private String getAdminToken() throws Exception {
		String username = "admin-mgmt-" + UUID.randomUUID().toString().substring(0, 8);
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
	void listUsersReturnsPaginatedResults() throws Exception {
		String adminToken = getAdminToken();
		authAs(adminToken).when().get("/api/v1/admin/users?needsTotal=true").then().statusCode(200)
				.body("items", notNullValue()).body("items.size()", greaterThanOrEqualTo(1))
				.body("totalItems", greaterThanOrEqualTo(1));
	}

	@Test
	void listUsersWithSearchFilters() throws Exception {
		String adminToken = getAdminToken();
		authAs(adminToken).when().get("/api/v1/admin/users?search=admin-mgmt").then().statusCode(200)
				.body("items.size()", greaterThanOrEqualTo(1));
	}

	@Test
	void getUserByIdReturnsDetail() throws Exception {
		String adminToken = getAdminToken();
		String userId = authAs(adminToken).when().get("/api/v1/auth/me").then().statusCode(200).extract().path("id");

		authAs(adminToken).when().get("/api/v1/admin/users/" + userId).then().statusCode(200)
				.body("id", equalTo(userId)).body("instanceRole", equalTo("ADMIN")).body("active", equalTo(true))
				.body("providers", notNullValue()).body("photoCount", notNullValue())
				.body("storageBytesUsed", notNullValue());
	}

	@Test
	void getUserByIdReturns404ForUnknown() throws Exception {
		String adminToken = getAdminToken();
		authAs(adminToken).when().get("/api/v1/admin/users/" + UUID.randomUUID()).then().statusCode(404);
	}

	@Test
	void updateUserRoleWorks() throws Exception {
		String adminToken = getAdminToken();
		String targetToken = registerUser("update-target");
		String targetId = authAs(targetToken).when().get("/api/v1/auth/me").then().statusCode(200).extract().path("id");

		authAs(adminToken).body("{\"instanceRole\":\"ADMIN\"}").when().put("/api/v1/admin/users/" + targetId).then()
				.statusCode(200).body("instanceRole", equalTo("ADMIN"));
	}

	@Test
	void updateUserDeactivateWorks() throws Exception {
		String adminToken = getAdminToken();
		String targetToken = registerUser("deactivate-target");
		String targetId = authAs(targetToken).when().get("/api/v1/auth/me").then().statusCode(200).extract().path("id");

		authAs(adminToken).body("{\"active\":false}").when().put("/api/v1/admin/users/" + targetId).then()
				.statusCode(200).body("active", equalTo(false));
	}

	@Test
	void cannotDemoteSelf() throws Exception {
		String adminToken = getAdminToken();
		String adminId = authAs(adminToken).when().get("/api/v1/auth/me").then().statusCode(200).extract().path("id");

		authAs(adminToken).body("{\"instanceRole\":\"USER\"}").when().put("/api/v1/admin/users/" + adminId).then()
				.statusCode(400);
	}

	@Test
	void cannotDeactivateSelf() throws Exception {
		String adminToken = getAdminToken();
		String adminId = authAs(adminToken).when().get("/api/v1/auth/me").then().statusCode(200).extract().path("id");

		authAs(adminToken).body("{\"active\":false}").when().put("/api/v1/admin/users/" + adminId).then()
				.statusCode(400);
	}

	@Test
	void nonAdminGetsForbidden() {
		String token = registerUser("non-admin");
		String role = authAs(token).when().get("/api/v1/auth/me").then().extract().path("instanceRole");
		if ("ADMIN".equals(role)) {
			token = registerUser("non-admin-b");
		}
		authAs(token).when().get("/api/v1/admin/users").then().statusCode(403);
	}
}
