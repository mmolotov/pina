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
class AdminInviteResourceTest {

	@Inject
	EntityManager em;

	@Inject
	UserTransaction tx;

	private static RequestSpecification authAs(String token) {
		return given().header("Authorization", "Bearer " + token).contentType(ContentType.JSON);
	}

	private String getAdminToken() throws Exception {
		String username = "admin-invite-" + UUID.randomUUID().toString().substring(0, 8);
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
	void listInvitesReturnsResults() throws Exception {
		String adminToken = getAdminToken();

		// Create a space and an invite link
		String spaceId = authAs(adminToken).body("{\"name\": \"Invite Test Space\"}").when().post("/api/v1/spaces")
				.then().statusCode(201).extract().path("id");

		authAs(adminToken).body("{\"defaultRole\": \"MEMBER\"}").when().post("/api/v1/spaces/" + spaceId + "/invites")
				.then().statusCode(201);

		authAs(adminToken).when().get("/api/v1/admin/invites?needsTotal=true").then().statusCode(200)
				.body("items", notNullValue()).body("items.size()", greaterThanOrEqualTo(1))
				.body("totalItems", greaterThanOrEqualTo(1));
	}

	@Test
	void listInvitesFiltersBySpaceId() throws Exception {
		String adminToken = getAdminToken();

		String spaceId = authAs(adminToken).body("{\"name\": \"Filter Invite Space\"}").when().post("/api/v1/spaces")
				.then().statusCode(201).extract().path("id");

		authAs(adminToken).body("{\"defaultRole\": \"VIEWER\"}").when().post("/api/v1/spaces/" + spaceId + "/invites")
				.then().statusCode(201);

		authAs(adminToken).when().get("/api/v1/admin/invites?spaceId=" + spaceId).then().statusCode(200)
				.body("items.size()", greaterThanOrEqualTo(1));
	}

	@Test
	void listInvitesFiltersByActive() throws Exception {
		String adminToken = getAdminToken();
		authAs(adminToken).when().get("/api/v1/admin/invites?active=true").then().statusCode(200).body("items",
				notNullValue());
	}

	@Test
	void revokeInviteReturns204() throws Exception {
		String adminToken = getAdminToken();

		String spaceId = authAs(adminToken).body("{\"name\": \"Revoke Invite Space\"}").when().post("/api/v1/spaces")
				.then().statusCode(201).extract().path("id");

		String inviteId = authAs(adminToken).body("{\"defaultRole\": \"MEMBER\"}").when()
				.post("/api/v1/spaces/" + spaceId + "/invites").then().statusCode(201).extract().path("id");

		authAs(adminToken).when().delete("/api/v1/admin/invites/" + inviteId).then().statusCode(204);
	}

	@Test
	void revokeUnknownInviteReturns404() throws Exception {
		String adminToken = getAdminToken();
		authAs(adminToken).when().delete("/api/v1/admin/invites/" + UUID.randomUUID()).then().statusCode(404);
	}

	@Test
	void inviteResponseIncludesMetadata() throws Exception {
		String adminToken = getAdminToken();

		String spaceId = authAs(adminToken).body("{\"name\": \"Meta Invite Space\"}").when().post("/api/v1/spaces")
				.then().statusCode(201).extract().path("id");

		authAs(adminToken).body("{\"defaultRole\": \"MEMBER\"}").when().post("/api/v1/spaces/" + spaceId + "/invites")
				.then().statusCode(201);

		authAs(adminToken).when().get("/api/v1/admin/invites?spaceId=" + spaceId).then().statusCode(200)
				.body("items[0].code", notNullValue()).body("items[0].spaceName", notNullValue())
				.body("items[0].createdByName", notNullValue()).body("items[0].defaultRole", equalTo("MEMBER"));
	}

	@Test
	void nonAdminGetsForbidden() {
		String username = "non-admin-invite-" + UUID.randomUUID().toString().substring(0, 8);
		String token = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");

		String role = authAs(token).when().get("/api/v1/auth/me").then().extract().path("instanceRole");
		if ("ADMIN".equals(role)) {
			username = "non-admin-invite-b-" + UUID.randomUUID().toString().substring(0, 8);
			token = given().contentType(ContentType.JSON)
					.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
					.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");
		}

		authAs(token).when().get("/api/v1/admin/invites").then().statusCode(403);
	}
}
