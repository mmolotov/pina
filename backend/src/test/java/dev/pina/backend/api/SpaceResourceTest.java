package dev.pina.backend.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;

import dev.pina.backend.TestAuthHelper;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import java.util.UUID;
import org.junit.jupiter.api.Test;

@QuarkusTest
class SpaceResourceTest {

	private static RequestSpecification auth() {
		return TestAuthHelper.authenticated().contentType(ContentType.JSON);
	}

	private static String registerUser(String suffix) {
		String username = "space-test-" + suffix + "-" + UUID.randomUUID().toString().substring(0, 8);
		return given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");
	}

	private static RequestSpecification authAs(String token) {
		return given().header("Authorization", "Bearer " + token).contentType(ContentType.JSON);
	}

	private static String currentUserId(String token) {
		return authAs(token).when().get("/api/v1/auth/me").then().statusCode(200).extract().path("id");
	}

	// ── Create ────────────────────────────────────────────────────────────

	@Test
	void createSpaceReturns201() {
		auth().body("{\"name\": \"Test Space\", \"description\": \"A test space\"}").when().post("/api/v1/spaces")
				.then().statusCode(201).body("id", notNullValue()).body("name", equalTo("Test Space"))
				.body("depth", equalTo(0));
	}

	@Test
	void createSpaceWithBlankNameReturns400() {
		auth().body("{\"name\": \"\"}").when().post("/api/v1/spaces").then().statusCode(400);
	}

	// ── List ──────────────────────────────────────────────────────────────

	@Test
	void listSpacesReturnsUserSpaces() {
		String token = registerUser("list");
		authAs(token).body("{\"name\": \"Listed Space\"}").when().post("/api/v1/spaces").then().statusCode(201);

		authAs(token).when().get("/api/v1/spaces").then().statusCode(200).body("$", hasSize(1)).body("[0].name",
				equalTo("Listed Space"));
	}

	@Test
	void listSpacesIncludesInheritedSubspaces() {
		String ownerToken = registerUser("list-inherit-owner");
		String memberToken = registerUser("list-inherit-member");

		String parentId = authAs(ownerToken).body("{\"name\": \"Parent Visible\"}").when().post("/api/v1/spaces").then()
				.statusCode(201).extract().path("id");
		String childId = authAs(ownerToken).body("{\"name\": \"Child Visible\"}").when()
				.post("/api/v1/spaces/{id}/subspaces", parentId).then().statusCode(201).extract().path("id");

		String memberId = authAs(memberToken).when().get("/api/v1/auth/me").then().extract().path("id");
		authAs(ownerToken).body("{\"userId\": \"" + memberId + "\", \"role\": \"MEMBER\"}").when()
				.post("/api/v1/spaces/{id}/members", parentId).then().statusCode(201);

		authAs(memberToken).when().get("/api/v1/spaces").then().statusCode(200).body("$", hasSize(2)).body("id",
				org.hamcrest.Matchers.hasItems(parentId, childId));
	}

	// ── Get by ID ─────────────────────────────────────────────────────────

	@Test
	void getSpaceByIdReturnsSpace() {
		String id = auth().body("{\"name\": \"Get Me\"}").when().post("/api/v1/spaces").then().statusCode(201).extract()
				.path("id");

		auth().when().get("/api/v1/spaces/{id}", id).then().statusCode(200).body("name", equalTo("Get Me"));
	}

	@Test
	void getSpaceByNonMemberReturns404() {
		String id = auth().body("{\"name\": \"Private\"}").when().post("/api/v1/spaces").then().statusCode(201)
				.extract().path("id");

		String otherToken = registerUser("non-member");
		authAs(otherToken).when().get("/api/v1/spaces/{id}", id).then().statusCode(404).body("error",
				equalTo("not_found"));
	}

	// ── Update ────────────────────────────────────────────────────────────

	@Test
	void updateSpaceAsOwner() {
		String id = auth().body("{\"name\": \"Original\"}").when().post("/api/v1/spaces").then().statusCode(201)
				.extract().path("id");

		auth().body("{\"name\": \"Updated\", \"description\": \"New desc\"}").when().put("/api/v1/spaces/{id}", id)
				.then().statusCode(200).body("name", equalTo("Updated"));
	}

	@Test
	void updateSpaceAsMemberReturns404() {
		String ownerToken = registerUser("upd-owner");
		String id = authAs(ownerToken).body("{\"name\": \"Owner Space\"}").when().post("/api/v1/spaces").then()
				.statusCode(201).extract().path("id");

		String memberToken = registerUser("upd-member");
		String memberId = authAs(memberToken).when().get("/api/v1/auth/me").then().extract().path("id");
		authAs(ownerToken).body("{\"userId\": \"" + memberId + "\", \"role\": \"MEMBER\"}").when()
				.post("/api/v1/spaces/{id}/members", id).then().statusCode(201);

		authAs(memberToken).body("{\"name\": \"Hacked\"}").when().put("/api/v1/spaces/{id}", id).then().statusCode(404);
	}

	// ── Delete ────────────────────────────────────────────────────────────

	@Test
	void deleteSpaceAsOwner() {
		String id = auth().body("{\"name\": \"Delete Me\"}").when().post("/api/v1/spaces").then().statusCode(201)
				.extract().path("id");

		auth().when().delete("/api/v1/spaces/{id}", id).then().statusCode(204);
	}

	@Test
	void deleteSpaceAsAdminReturns404() {
		String ownerToken = registerUser("del-owner");
		String id = authAs(ownerToken).body("{\"name\": \"Admin Cant Delete\"}").when().post("/api/v1/spaces").then()
				.statusCode(201).extract().path("id");

		String adminToken = registerUser("del-admin");
		String adminId = authAs(adminToken).when().get("/api/v1/auth/me").then().extract().path("id");
		authAs(ownerToken).body("{\"userId\": \"" + adminId + "\", \"role\": \"ADMIN\"}").when()
				.post("/api/v1/spaces/{id}/members", id).then().statusCode(201);

		authAs(adminToken).when().delete("/api/v1/spaces/{id}", id).then().statusCode(404);
	}

	// ── Members ───────────────────────────────────────────────────────────

	@Test
	void addAndListMembers() {
		String ownerToken = registerUser("mbr-owner");
		String id = authAs(ownerToken).body("{\"name\": \"Members Space\"}").when().post("/api/v1/spaces").then()
				.statusCode(201).extract().path("id");

		String memberToken = registerUser("mbr-user");
		String memberId = authAs(memberToken).when().get("/api/v1/auth/me").then().extract().path("id");

		authAs(ownerToken).body("{\"userId\": \"" + memberId + "\", \"role\": \"MEMBER\"}").when()
				.post("/api/v1/spaces/{id}/members", id).then().statusCode(201);

		authAs(ownerToken).when().get("/api/v1/spaces/{id}/members", id).then().statusCode(200).body("items",
				hasSize(2));
	}

	@Test
	void addMemberAsNonAdminReturns404() {
		String ownerToken = registerUser("mbr-no-perm-owner");
		String id = authAs(ownerToken).body("{\"name\": \"No Perm\"}").when().post("/api/v1/spaces").then()
				.statusCode(201).extract().path("id");

		String viewerToken = registerUser("mbr-no-perm-viewer");
		String viewerId = authAs(viewerToken).when().get("/api/v1/auth/me").then().extract().path("id");
		authAs(ownerToken).body("{\"userId\": \"" + viewerId + "\", \"role\": \"VIEWER\"}").when()
				.post("/api/v1/spaces/{id}/members", id).then().statusCode(201);

		String outsiderToken = registerUser("mbr-no-perm-outsider");
		String outsiderId = authAs(outsiderToken).when().get("/api/v1/auth/me").then().extract().path("id");
		authAs(viewerToken).body("{\"userId\": \"" + outsiderId + "\"}").when().post("/api/v1/spaces/{id}/members", id)
				.then().statusCode(404);
	}

	@Test
	void addMemberWithOwnerRoleReturns400() {
		String ownerToken = registerUser("mbr-own-role-owner");
		String id = authAs(ownerToken).body("{\"name\": \"No Owner Add\"}").when().post("/api/v1/spaces").then()
				.statusCode(201).extract().path("id");

		String userToken = registerUser("mbr-own-role-user");
		String userId = authAs(userToken).when().get("/api/v1/auth/me").then().extract().path("id");

		authAs(ownerToken).body("{\"userId\": \"" + userId + "\", \"role\": \"OWNER\"}").when()
				.post("/api/v1/spaces/{id}/members", id).then().statusCode(400);
	}

	// ── Change role ───────────────────────────────────────────────────────

	@Test
	void ownerCanChangeRoleToAdmin() {
		String ownerToken = registerUser("role-owner");
		String id = authAs(ownerToken).body("{\"name\": \"Role Space\"}").when().post("/api/v1/spaces").then()
				.statusCode(201).extract().path("id");

		String memberToken = registerUser("role-member");
		String memberId = authAs(memberToken).when().get("/api/v1/auth/me").then().extract().path("id");
		authAs(ownerToken).body("{\"userId\": \"" + memberId + "\", \"role\": \"MEMBER\"}").when()
				.post("/api/v1/spaces/{id}/members", id).then().statusCode(201);

		authAs(ownerToken).body("{\"role\": \"ADMIN\"}").when().put("/api/v1/spaces/{id}/members/{uid}", id, memberId)
				.then().statusCode(200).body("role", equalTo("ADMIN"));
	}

	@Test
	void adminCannotPromoteToAdmin() {
		String ownerToken = registerUser("promo-owner");
		String id = authAs(ownerToken).body("{\"name\": \"Promo Space\"}").when().post("/api/v1/spaces").then()
				.statusCode(201).extract().path("id");

		String adminToken = registerUser("promo-admin");
		String adminId = authAs(adminToken).when().get("/api/v1/auth/me").then().extract().path("id");
		authAs(ownerToken).body("{\"userId\": \"" + adminId + "\", \"role\": \"ADMIN\"}").when()
				.post("/api/v1/spaces/{id}/members", id).then().statusCode(201);

		String memberToken = registerUser("promo-member");
		String memberId = authAs(memberToken).when().get("/api/v1/auth/me").then().extract().path("id");
		authAs(ownerToken).body("{\"userId\": \"" + memberId + "\", \"role\": \"MEMBER\"}").when()
				.post("/api/v1/spaces/{id}/members", id).then().statusCode(201);

		authAs(adminToken).body("{\"role\": \"ADMIN\"}").when().put("/api/v1/spaces/{id}/members/{uid}", id, memberId)
				.then().statusCode(400);
	}

	@Test
	void inheritedAdminCanChangeDirectChildMembership() {
		String ownerToken = registerUser("inherit-role-owner");
		String parentId = authAs(ownerToken).body("{\"name\": \"Parent Role Space\"}").when().post("/api/v1/spaces")
				.then().statusCode(201).extract().path("id");
		String childId = authAs(ownerToken).body("{\"name\": \"Child Role Space\"}").when()
				.post("/api/v1/spaces/{id}/subspaces", parentId).then().statusCode(201).extract().path("id");

		String adminToken = registerUser("inherit-role-admin");
		String adminId = authAs(adminToken).when().get("/api/v1/auth/me").then().extract().path("id");
		authAs(ownerToken).body("{\"userId\": \"" + adminId + "\", \"role\": \"ADMIN\"}").when()
				.post("/api/v1/spaces/{id}/members", parentId).then().statusCode(201);

		String memberToken = registerUser("inherit-role-member");
		String memberId = authAs(memberToken).when().get("/api/v1/auth/me").then().extract().path("id");
		authAs(ownerToken).body("{\"userId\": \"" + memberId + "\", \"role\": \"MEMBER\"}").when()
				.post("/api/v1/spaces/{id}/members", childId).then().statusCode(201);

		authAs(adminToken).body("{\"role\": \"VIEWER\"}").when()
				.put("/api/v1/spaces/{id}/members/{uid}", childId, memberId).then().statusCode(200)
				.body("role", equalTo("VIEWER"));
	}

	// ── Remove member ─────────────────────────────────────────────────────

	@Test
	void ownerCanRemoveMember() {
		String ownerToken = registerUser("rm-owner");
		String id = authAs(ownerToken).body("{\"name\": \"Remove Space\"}").when().post("/api/v1/spaces").then()
				.statusCode(201).extract().path("id");

		String memberToken = registerUser("rm-member");
		String memberId = authAs(memberToken).when().get("/api/v1/auth/me").then().extract().path("id");
		authAs(ownerToken).body("{\"userId\": \"" + memberId + "\", \"role\": \"MEMBER\"}").when()
				.post("/api/v1/spaces/{id}/members", id).then().statusCode(201);

		authAs(ownerToken).when().delete("/api/v1/spaces/{id}/members/{uid}", id, memberId).then().statusCode(204);
	}

	@Test
	void memberCanSelfLeave() {
		String ownerToken = registerUser("leave-owner");
		String id = authAs(ownerToken).body("{\"name\": \"Leave Space\"}").when().post("/api/v1/spaces").then()
				.statusCode(201).extract().path("id");

		String memberToken = registerUser("leave-member");
		String memberId = authAs(memberToken).when().get("/api/v1/auth/me").then().extract().path("id");
		authAs(ownerToken).body("{\"userId\": \"" + memberId + "\", \"role\": \"MEMBER\"}").when()
				.post("/api/v1/spaces/{id}/members", id).then().statusCode(201);

		authAs(memberToken).when().delete("/api/v1/spaces/{id}/members/{uid}", id, memberId).then().statusCode(204);
	}

	@Test
	void inheritedAdminCanRemoveDirectChildMember() {
		String ownerToken = registerUser("inherit-rm-owner");
		String parentId = authAs(ownerToken).body("{\"name\": \"Parent Remove Space\"}").when().post("/api/v1/spaces")
				.then().statusCode(201).extract().path("id");
		String childId = authAs(ownerToken).body("{\"name\": \"Child Remove Space\"}").when()
				.post("/api/v1/spaces/{id}/subspaces", parentId).then().statusCode(201).extract().path("id");

		String adminToken = registerUser("inherit-rm-admin");
		String adminId = authAs(adminToken).when().get("/api/v1/auth/me").then().extract().path("id");
		authAs(ownerToken).body("{\"userId\": \"" + adminId + "\", \"role\": \"ADMIN\"}").when()
				.post("/api/v1/spaces/{id}/members", parentId).then().statusCode(201);

		String memberToken = registerUser("inherit-rm-member");
		String memberId = authAs(memberToken).when().get("/api/v1/auth/me").then().extract().path("id");
		authAs(ownerToken).body("{\"userId\": \"" + memberId + "\", \"role\": \"MEMBER\"}").when()
				.post("/api/v1/spaces/{id}/members", childId).then().statusCode(201);

		authAs(adminToken).when().delete("/api/v1/spaces/{id}/members/{uid}", childId, memberId).then().statusCode(204);
	}

	@Test
	void ownerCannotLeave() {
		String ownerToken = registerUser("noleave-owner");
		String id = authAs(ownerToken).body("{\"name\": \"No Leave\"}").when().post("/api/v1/spaces").then()
				.statusCode(201).extract().path("id");

		String ownerId = authAs(ownerToken).when().get("/api/v1/auth/me").then().extract().path("id");
		authAs(ownerToken).when().delete("/api/v1/spaces/{id}/members/{uid}", id, ownerId).then().statusCode(400);
	}

	// ── Subspaces ─────────────────────────────────────────────────────────

	@Test
	void createAndListSubspaces() {
		String ownerToken = registerUser("sub-owner");
		String parentId = authAs(ownerToken).body("{\"name\": \"Parent Space\"}").when().post("/api/v1/spaces").then()
				.statusCode(201).extract().path("id");

		authAs(ownerToken).body("{\"name\": \"Child A\"}").when().post("/api/v1/spaces/{id}/subspaces", parentId).then()
				.statusCode(201).body("depth", equalTo(1)).body("parentId", equalTo(parentId));

		authAs(ownerToken).body("{\"name\": \"Child B\"}").when().post("/api/v1/spaces/{id}/subspaces", parentId).then()
				.statusCode(201);

		authAs(ownerToken).when().get("/api/v1/spaces/{id}/subspaces", parentId).then().statusCode(200).body("$",
				hasSize(2));
	}

	@Test
	void createSubspaceAsMemberReturns404() {
		String ownerToken = registerUser("sub-perm-owner");
		String parentId = authAs(ownerToken).body("{\"name\": \"Sub Perm\"}").when().post("/api/v1/spaces").then()
				.statusCode(201).extract().path("id");

		String memberToken = registerUser("sub-perm-member");
		String memberId = authAs(memberToken).when().get("/api/v1/auth/me").then().extract().path("id");
		authAs(ownerToken).body("{\"userId\": \"" + memberId + "\", \"role\": \"MEMBER\"}").when()
				.post("/api/v1/spaces/{id}/members", parentId).then().statusCode(201);

		authAs(memberToken).body("{\"name\": \"Not Allowed\"}").when().post("/api/v1/spaces/{id}/subspaces", parentId)
				.then().statusCode(404);
	}

	@Test
	void listSubspacesIncludesInheritedAndDirectAccessOnly() {
		String ownerToken = registerUser("sub-visible-owner");
		String memberToken = registerUser("sub-visible-member");
		String parentId = authAs(ownerToken).body("{\"name\": \"Sub Visible Parent\"}").when().post("/api/v1/spaces")
				.then().statusCode(201).extract().path("id");
		String inheritedChildId = authAs(ownerToken).body("{\"name\": \"Inherited Child\"}").when()
				.post("/api/v1/spaces/{id}/subspaces", parentId).then().statusCode(201).extract().path("id");
		String hiddenChildId = authAs(ownerToken).body("{\"name\": \"Hidden Child\"}").when()
				.post("/api/v1/spaces/{id}/subspaces", parentId).then().statusCode(201).extract().path("id");
		String directChildId = authAs(ownerToken).body("{\"name\": \"Direct Child\"}").when()
				.post("/api/v1/spaces/{id}/subspaces", parentId).then().statusCode(201).extract().path("id");

		String memberId = currentUserId(memberToken);
		authAs(ownerToken).body("{\"userId\": \"" + memberId + "\", \"role\": \"MEMBER\"}").when()
				.post("/api/v1/spaces/{id}/members", parentId).then().statusCode(201);
		authAs(ownerToken).body("{\"name\": \"Hidden Child\", \"inheritMembers\": false}").when()
				.put("/api/v1/spaces/{id}", hiddenChildId).then().statusCode(200);
		authAs(ownerToken).body("{\"name\": \"Direct Child\", \"inheritMembers\": false}").when()
				.put("/api/v1/spaces/{id}", directChildId).then().statusCode(200);
		authAs(ownerToken).body("{\"userId\": \"" + memberId + "\", \"role\": \"VIEWER\"}").when()
				.post("/api/v1/spaces/{id}/members", directChildId).then().statusCode(201);

		authAs(memberToken).when().get("/api/v1/spaces/{id}/subspaces", parentId).then().statusCode(200)
				.body("$", hasSize(2)).body("id", org.hamcrest.Matchers.hasItems(inheritedChildId, directChildId))
				.body("id", org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem(hiddenChildId)));
	}

	// ── Non-existent space ────────────────────────────────────────────────

	@Test
	void getNonExistentSpaceReturns404() {
		auth().when().get("/api/v1/spaces/00000000-0000-0000-0000-000000000000").then().statusCode(404).body("error",
				equalTo("not_found"));
	}
}
