package dev.pina.backend.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

import dev.pina.backend.domain.InstanceRole;
import dev.pina.backend.service.GoogleTokenVerifier;
import dev.pina.backend.service.GoogleTokenVerifier.GoogleIdToken;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.UserTransaction;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AuthResourceGoogleTest {

	@InjectMock
	GoogleTokenVerifier googleTokenVerifier;

	@Inject
	EntityManager em;

	@Inject
	UserTransaction tx;

	@Test
	void googleLoginWithValidTokenReturns200() {
		String googleSub = "google-" + UUID.randomUUID();
		when(googleTokenVerifier.verify("valid-token-1"))
				.thenReturn(Optional.of(new GoogleIdToken(googleSub, "test@gmail.com", "Test User", null)));

		given().contentType(ContentType.JSON).body("{\"idToken\":\"valid-token-1\"}").when().post("/api/v1/auth/google")
				.then().statusCode(200).body("accessToken", notNullValue()).body("refreshToken", notNullValue())
				.body("user.name", equalTo("Test User"));
	}

	@Test
	void googleLoginWithInvalidTokenReturns401() {
		when(googleTokenVerifier.verify("invalid-token")).thenReturn(Optional.empty());

		given().contentType(ContentType.JSON).body("{\"idToken\":\"invalid-token\"}").when().post("/api/v1/auth/google")
				.then().statusCode(401);
	}

	@Test
	void googleLoginCreatesPersistentUser() {
		String googleSub = "google-persist-" + UUID.randomUUID();
		when(googleTokenVerifier.verify("persist-token"))
				.thenReturn(Optional.of(new GoogleIdToken(googleSub, "persist@gmail.com", "Persist User", null)));

		String token1 = given().contentType(ContentType.JSON).body("{\"idToken\":\"persist-token\"}").when()
				.post("/api/v1/auth/google").then().statusCode(200).extract().path("accessToken");

		String userId1 = authAs(token1).when().get("/api/v1/auth/me").then().statusCode(200).extract().path("id");

		// Login again with the same Google account returns same user
		String token2 = given().contentType(ContentType.JSON).body("{\"idToken\":\"persist-token\"}").when()
				.post("/api/v1/auth/google").then().statusCode(200).extract().path("accessToken");

		String userId2 = authAs(token2).when().get("/api/v1/auth/me").then().statusCode(200).extract().path("id");

		assertEquals(userId1, userId2);
	}

	@Test
	void googleLoginWithBlankTokenReturns400() {
		given().contentType(ContentType.JSON).body("{\"idToken\":\"\"}").when().post("/api/v1/auth/google").then()
				.statusCode(400);
	}

	@Test
	void googleSignupIsBlockedWhenRegistrationClosed() throws Exception {
		String adminToken = getAdminToken();
		authAs(adminToken).body("{\"registrationMode\":\"CLOSED\"}").when().put("/api/v1/admin/settings").then()
				.statusCode(200);

		try {
			when(googleTokenVerifier.verify("closed-google-token"))
					.thenReturn(Optional.of(new GoogleIdToken("google-closed-" + UUID.randomUUID(), "closed@gmail.com",
							"Closed Google", null)));

			given().contentType(ContentType.JSON).body("{\"idToken\":\"closed-google-token\"}").when()
					.post("/api/v1/auth/google").then().statusCode(403).body("error", equalTo("forbidden"));
		} finally {
			authAs(adminToken).body("{\"registrationMode\":\"OPEN\"}").when().put("/api/v1/admin/settings").then()
					.statusCode(200);
		}
	}

	@Test
	void inactiveGoogleUserCannotLogin() throws Exception {
		String googleSub = "google-inactive-" + UUID.randomUUID();
		when(googleTokenVerifier.verify("inactive-google-token"))
				.thenReturn(Optional.of(new GoogleIdToken(googleSub, "inactive@gmail.com", "Inactive User", null)));

		String userId = given().contentType(ContentType.JSON).body("{\"idToken\":\"inactive-google-token\"}").when()
				.post("/api/v1/auth/google").then().statusCode(200).extract().path("user.id");

		deactivateUser(userId);

		given().contentType(ContentType.JSON).body("{\"idToken\":\"inactive-google-token\"}").when()
				.post("/api/v1/auth/google").then().statusCode(401).body("error", equalTo("unauthorized"));
	}

	@Test
	void googleLoginWithExistingEmailReturns409() {
		String username = "google-email-conflict-" + UUID.randomUUID().toString().substring(0, 8);
		String token = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");

		authAs(token).body("{\"email\":\"conflict@gmail.com\"}").when().put("/api/v1/auth/me").then().statusCode(200);

		when(googleTokenVerifier.verify("email-conflict-token"))
				.thenReturn(Optional.of(new GoogleIdToken("google-email-conflict-" + UUID.randomUUID(),
						"conflict@gmail.com", "Conflict User", null)));

		given().contentType(ContentType.JSON).body("{\"idToken\":\"email-conflict-token\"}").when()
				.post("/api/v1/auth/google").then().statusCode(409);
	}

	@Test
	void linkGoogleAccountToExistingUser() {
		String username = "link-test-" + UUID.randomUUID().toString().substring(0, 8);
		String token = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");

		String googleSub = "google-link-" + UUID.randomUUID();
		when(googleTokenVerifier.verify("link-token"))
				.thenReturn(Optional.of(new GoogleIdToken(googleSub, "link@gmail.com", "Link User", null)));

		authAs(token).body("{\"idToken\":\"link-token\"}").when().post("/api/v1/auth/link/google").then()
				.statusCode(200);
	}

	@Test
	void linkGoogleAccountAlreadyLinkedToAnotherUserReturns409() {
		String googleSub = "google-conflict-" + UUID.randomUUID();
		when(googleTokenVerifier.verify("conflict-token"))
				.thenReturn(Optional.of(new GoogleIdToken(googleSub, "conflict@gmail.com", "Conflict User", null)));

		String user1 = "conflict1-" + UUID.randomUUID().toString().substring(0, 8);
		String token1 = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + user1 + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");
		authAs(token1).body("{\"idToken\":\"conflict-token\"}").when().post("/api/v1/auth/link/google").then()
				.statusCode(200);

		String user2 = "conflict2-" + UUID.randomUUID().toString().substring(0, 8);
		String token2 = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + user2 + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");
		authAs(token2).body("{\"idToken\":\"conflict-token\"}").when().post("/api/v1/auth/link/google").then()
				.statusCode(409);
	}

	@Test
	void linkGoogleWithInvalidTokenReturns401() {
		String username = "link-invalid-" + UUID.randomUUID().toString().substring(0, 8);
		String token = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"testpass123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract().path("accessToken");

		when(googleTokenVerifier.verify("bad-token")).thenReturn(Optional.empty());

		authAs(token).body("{\"idToken\":\"bad-token\"}").when().post("/api/v1/auth/link/google").then()
				.statusCode(401);
	}

	private static RequestSpecification authAs(String token) {
		return given().header("Authorization", "Bearer " + token).contentType(ContentType.JSON);
	}

	private String getAdminToken() throws Exception {
		String username = "admin-google-" + UUID.randomUUID().toString().substring(0, 8);
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

	private void deactivateUser(String userId) throws Exception {
		tx.begin();
		em.createQuery("UPDATE User u SET u.active = false WHERE u.id = :id")
				.setParameter("id", UUID.fromString(userId)).executeUpdate();
		tx.commit();
	}
}
