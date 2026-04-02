package dev.pina.backend.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;

@QuarkusTest
class InviteLinkResourceTest {

	private static String registerUser(String suffix) {
		String username = "invite-test-" + suffix + "-" + UUID.randomUUID().toString().substring(0, 8);
		return given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");
	}

	private static RequestSpecification authAs(String token) {
		return given().header("Authorization", "Bearer " + token).contentType(ContentType.JSON);
	}

	private static String createSpace(String token, String name) {
		return authAs(token).body("{\"name\":\"" + name + "\"}").when().post("/api/v1/spaces").then().statusCode(201)
				.extract().path("id");
	}

	private static String createSubspace(String token, String parentId, String name) {
		return authAs(token).body("{\"name\":\"" + name + "\"}").when()
				.post("/api/v1/spaces/" + parentId + "/subspaces").then().statusCode(201).extract().path("id");
	}

	private static String addMember(String ownerToken, String spaceId, String memberToken, String role) {
		String memberId = authAs(memberToken).when().get("/api/v1/auth/me").then().statusCode(200).extract().path("id");
		authAs(ownerToken).body("{\"userId\":\"" + memberId + "\",\"role\":\"" + role + "\"}").when()
				.post("/api/v1/spaces/" + spaceId + "/members").then().statusCode(201);
		return memberId;
	}

	@Test
	void createInviteLinkReturns201() {
		String token = registerUser("create");
		String spaceId = createSpace(token, "Invite Space");

		authAs(token).body("{}").when().post("/api/v1/spaces/" + spaceId + "/invites").then().statusCode(201)
				.body("code", notNullValue()).body("defaultRole", equalTo("MEMBER")).body("active", equalTo(true));
	}

	@Test
	void createInviteLinkWithCustomRole() {
		String token = registerUser("role");
		String spaceId = createSpace(token, "Role Space");

		authAs(token).body("{\"defaultRole\":\"VIEWER\"}").when().post("/api/v1/spaces/" + spaceId + "/invites").then()
				.statusCode(201).body("defaultRole", equalTo("VIEWER"));
	}

	@Test
	void createInviteLinkWithOwnerRoleReturns400() {
		String token = registerUser("owner-role");
		String spaceId = createSpace(token, "Owner Role Space");

		authAs(token).body("{\"defaultRole\":\"OWNER\"}").when().post("/api/v1/spaces/" + spaceId + "/invites").then()
				.statusCode(400);
	}

	@Test
	void listInviteLinks() {
		String token = registerUser("list");
		String spaceId = createSpace(token, "List Space");

		authAs(token).body("{}").when().post("/api/v1/spaces/" + spaceId + "/invites").then().statusCode(201);
		authAs(token).body("{}").when().post("/api/v1/spaces/" + spaceId + "/invites").then().statusCode(201);

		authAs(token).when().get("/api/v1/spaces/" + spaceId + "/invites").then().statusCode(200).body("$", hasSize(2));
	}

	@Test
	void revokeInviteLink() {
		String token = registerUser("revoke");
		String spaceId = createSpace(token, "Revoke Space");

		String inviteId = authAs(token).body("{}").when().post("/api/v1/spaces/" + spaceId + "/invites").then()
				.statusCode(201).extract().path("id");

		authAs(token).when().delete("/api/v1/spaces/" + spaceId + "/invites/" + inviteId).then().statusCode(204);
	}

	@Test
	void listInviteLinksExcludesRevokedInvites() {
		String token = registerUser("active-only");
		String spaceId = createSpace(token, "Active Invite Space");

		String keepId = authAs(token).body("{}").when().post("/api/v1/spaces/" + spaceId + "/invites").then()
				.statusCode(201).extract().path("id");
		String revokeId = authAs(token).body("{}").when().post("/api/v1/spaces/" + spaceId + "/invites").then()
				.statusCode(201).extract().path("id");

		authAs(token).when().delete("/api/v1/spaces/" + spaceId + "/invites/" + revokeId).then().statusCode(204);

		authAs(token).when().get("/api/v1/spaces/" + spaceId + "/invites").then().statusCode(200).body("$", hasSize(1))
				.body("[0].id", equalTo(keepId)).body("[0].active", equalTo(true));
	}

	@Test
	void previewInviteLink() {
		String token = registerUser("preview");
		String spaceId = createSpace(token, "Preview Space");

		String code = authAs(token).body("{}").when().post("/api/v1/spaces/" + spaceId + "/invites").then()
				.statusCode(201).extract().path("code");

		given().when().get("/api/v1/invites/" + code).then().statusCode(200).body("spaceName",
				equalTo("Preview Space"));
	}

	@Test
	void previewExpiredInviteReturns404() {
		String token = registerUser("preview-expired");
		String spaceId = createSpace(token, "Expired Preview Space");

		String code = authAs(token).body("{\"expiration\":\"" + OffsetDateTime.now().minusMinutes(5) + "\"}").when()
				.post("/api/v1/spaces/" + spaceId + "/invites").then().statusCode(201).extract().path("code");

		given().when().get("/api/v1/invites/" + code).then().statusCode(404);
	}

	@Test
	void previewUsageLimitExhaustedInviteReturns404() {
		String ownerToken = registerUser("preview-limit-owner");
		String spaceId = createSpace(ownerToken, "Exhausted Preview Space");

		String code = authAs(ownerToken).body("{\"usageLimit\":1}").when()
				.post("/api/v1/spaces/" + spaceId + "/invites").then().statusCode(201).extract().path("code");

		String joinerToken = registerUser("preview-limit-joiner");
		authAs(joinerToken).when().post("/api/v1/invites/" + code + "/join").then().statusCode(200);

		given().when().get("/api/v1/invites/" + code).then().statusCode(404);
	}

	@Test
	void joinSpaceViaInviteLink() {
		String ownerToken = registerUser("join-owner");
		String spaceId = createSpace(ownerToken, "Join Space");

		String code = authAs(ownerToken).body("{}").when().post("/api/v1/spaces/" + spaceId + "/invites").then()
				.statusCode(201).extract().path("code");

		String joinerToken = registerUser("joiner");
		authAs(joinerToken).when().post("/api/v1/invites/" + code + "/join").then().statusCode(200);

		// Verify the joiner can now see the space
		authAs(joinerToken).when().get("/api/v1/spaces/" + spaceId).then().statusCode(200).body("name",
				equalTo("Join Space"));
	}

	@Test
	void joinAlreadyMemberReturns200WithoutConsumingInvite() {
		String ownerToken = registerUser("already-owner");
		String spaceId = createSpace(ownerToken, "Already Space");

		String code = authAs(ownerToken).body("{}").when().post("/api/v1/spaces/" + spaceId + "/invites").then()
				.statusCode(201).extract().path("code");

		// Owner tries to join their own space
		authAs(ownerToken).when().post("/api/v1/invites/" + code + "/join").then().statusCode(200);

		authAs(ownerToken).when().get("/api/v1/spaces/" + spaceId + "/invites").then().statusCode(200)
				.body("$", hasSize(1)).body("[0].usageCount", equalTo(0));
	}

	@Test
	void inheritedMemberJoinDoesNotConsumeInviteOrCreateDirectMembership() {
		String ownerToken = registerUser("inherit-owner");
		String inheritedToken = registerUser("inherit-member");
		String parentId = createSpace(ownerToken, "Parent Space");
		String childId = createSubspace(ownerToken, parentId, "Child Space");
		addMember(ownerToken, parentId, inheritedToken, "MEMBER");

		String code = authAs(ownerToken).body("{\"usageLimit\":1}").when()
				.post("/api/v1/spaces/" + childId + "/invites").then().statusCode(201).extract().path("code");

		authAs(inheritedToken).when().post("/api/v1/invites/" + code + "/join").then().statusCode(200);

		authAs(ownerToken).when().get("/api/v1/spaces/" + childId + "/invites").then().statusCode(200)
				.body("$", hasSize(1)).body("[0].usageCount", equalTo(0));
		authAs(ownerToken).when().get("/api/v1/spaces/" + childId + "/members").then().statusCode(200).body("$",
				hasSize(1));
	}

	@Test
	void joinWithRevokedInviteReturns404() {
		String ownerToken = registerUser("revoked-owner");
		String spaceId = createSpace(ownerToken, "Revoked Space");

		String inviteId = authAs(ownerToken).body("{}").when().post("/api/v1/spaces/" + spaceId + "/invites").then()
				.statusCode(201).extract().path("id");
		String code = authAs(ownerToken).when().get("/api/v1/spaces/" + spaceId + "/invites").then().statusCode(200)
				.extract().path("[0].code");

		authAs(ownerToken).when().delete("/api/v1/spaces/" + spaceId + "/invites/" + inviteId).then().statusCode(204);

		String joinerToken = registerUser("revoked-joiner");
		authAs(joinerToken).when().post("/api/v1/invites/" + code + "/join").then().statusCode(404);
	}

	@Test
	void joinWithInvalidCodeReturns404() {
		String token = registerUser("invalid-code");
		authAs(token).when().post("/api/v1/invites/nonexistent/join").then().statusCode(404);
	}

	@Test
	void joinWithoutAuthenticationReturns401() {
		String ownerToken = registerUser("unauth-owner");
		String spaceId = createSpace(ownerToken, "Unauth Join Space");

		String code = authAs(ownerToken).body("{}").when().post("/api/v1/spaces/" + spaceId + "/invites").then()
				.statusCode(201).extract().path("code");

		given().when().post("/api/v1/invites/" + code + "/join").then().statusCode(401);
	}

	@Test
	void nonAdminCannotCreateInvite() {
		String ownerToken = registerUser("nonadmin-owner");
		String spaceId = createSpace(ownerToken, "NonAdmin Space");

		// Add a member
		String memberToken = registerUser("nonadmin-member");
		String memberId = authAs(memberToken).when().get("/api/v1/auth/me").then().statusCode(200).extract().path("id");
		authAs(ownerToken).body("{\"userId\":\"" + memberId + "\",\"role\":\"MEMBER\"}").when()
				.post("/api/v1/spaces/" + spaceId + "/members").then().statusCode(201);

		// Member tries to create invite
		authAs(memberToken).body("{}").when().post("/api/v1/spaces/" + spaceId + "/invites").then().statusCode(404);
	}

	@Test
	void joinWithUsageLimitExhaustedReturns404() {
		String ownerToken = registerUser("limit-owner");
		String spaceId = createSpace(ownerToken, "Limit Space");

		String code = authAs(ownerToken).body("{\"usageLimit\":1}").when()
				.post("/api/v1/spaces/" + spaceId + "/invites").then().statusCode(201).extract().path("code");

		// First join succeeds
		String joiner1Token = registerUser("limit-joiner1");
		authAs(joiner1Token).when().post("/api/v1/invites/" + code + "/join").then().statusCode(200);

		// Second join fails — limit reached
		String joiner2Token = registerUser("limit-joiner2");
		authAs(joiner2Token).when().post("/api/v1/invites/" + code + "/join").then().statusCode(404);
	}
}
