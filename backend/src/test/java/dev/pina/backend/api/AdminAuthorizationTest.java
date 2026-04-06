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
class AdminAuthorizationTest {

	@Inject
	EntityManager em;

	@Inject
	UserTransaction tx;

	private static String registerUser(String suffix) {
		String username = "admin-auth-" + suffix + "-" + UUID.randomUUID().toString().substring(0, 8);
		return given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");
	}

	private static RequestSpecification authAs(String token) {
		return given().header("Authorization", "Bearer " + token).contentType(ContentType.JSON);
	}

	private String registerAndPromoteAdmin() throws Exception {
		String username = "admin-promoted-" + UUID.randomUUID().toString().substring(0, 8);
		String password = "testpass123";

		// Register user
		given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201);

		// Get user ID from /me using the registration token
		String regToken = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}").when()
				.post("/api/v1/auth/login").then().statusCode(200).extract().path("accessToken");
		String userId = authAs(regToken).when().get("/api/v1/auth/me").then().statusCode(200).extract().path("id");

		// Promote to admin directly in DB
		tx.begin();
		em.createQuery("UPDATE User u SET u.instanceRole = :role WHERE u.id = :id")
				.setParameter("role", InstanceRole.ADMIN).setParameter("id", UUID.fromString(userId)).executeUpdate();
		tx.commit();

		// Re-login to get JWT with updated admin claim
		return given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}").when()
				.post("/api/v1/auth/login").then().statusCode(200).extract().path("accessToken");
	}

	@Test
	void regularUserGetsForbiddenOnAdminEndpoint() {
		String token = registerUser("regular-403");

		// Ensure this user is NOT admin by checking /me
		String role = authAs(token).when().get("/api/v1/auth/me").then().statusCode(200).extract().path("instanceRole");
		if ("ADMIN".equals(role)) {
			// If auto-promoted, register another user who won't be admin
			token = registerUser("regular-403b");
		}

		authAs(token).when().get("/api/v1/admin/users").then().statusCode(403);
	}

	@Test
	void adminUserCanAccessAdminEndpoint() throws Exception {
		String adminToken = registerAndPromoteAdmin();
		authAs(adminToken).when().get("/api/v1/admin/users").then().statusCode(200);
	}

	@Test
	void unauthenticatedUserGets401OnAdminEndpoint() {
		given().contentType(ContentType.JSON).when().get("/api/v1/admin/users").then().statusCode(401);
	}

	@Test
	void meEndpointExposesInstanceRole() {
		String token = registerUser("me-role");
		authAs(token).when().get("/api/v1/auth/me").then().statusCode(200).body("instanceRole", notNullValue())
				.body("active", equalTo(true));
	}

	@Test
	void spaceAdminIsNotInstanceAdmin() {
		// Register two users
		String ownerToken = registerUser("space-owner");
		String memberToken = registerUser("space-member");

		// Ensure neither is instance admin (skip if auto-promoted)
		String ownerRole = authAs(ownerToken).when().get("/api/v1/auth/me").then().statusCode(200).extract()
				.path("instanceRole");
		String memberRole = authAs(memberToken).when().get("/api/v1/auth/me").then().statusCode(200).extract()
				.path("instanceRole");

		// The Space OWNER creates a Space — this makes them a Space OWNER
		authAs(ownerToken).body("{\"name\": \"Admin Test Space\"}").when().post("/api/v1/spaces").then()
				.statusCode(201);

		// Being a Space OWNER should not grant instance admin access
		if (!"ADMIN".equals(ownerRole)) {
			authAs(ownerToken).when().get("/api/v1/admin/users").then().statusCode(403);
		}
		if (!"ADMIN".equals(memberRole)) {
			authAs(memberToken).when().get("/api/v1/admin/users").then().statusCode(403);
		}
	}
}
