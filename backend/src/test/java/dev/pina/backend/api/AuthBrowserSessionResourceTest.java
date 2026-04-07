package dev.pina.backend.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import dev.pina.backend.domain.BrowserSession;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.response.ExtractableResponse;
import io.restassured.response.Response;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.UserTransaction;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AuthBrowserSessionResourceTest {

	@Inject
	EntityManager em;

	@Inject
	UserTransaction tx;

	@Test
	void sessionRegisterCreatesCookiesAndAllowsMe() {
		String username = "session-reg-" + UUID.randomUUID().toString().substring(0, 8);
		ExtractableResponse<Response> response = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"password123\",\"name\":\"Session User\"}")
				.when().post("/api/v1/auth/session/register").then().statusCode(200).body("id", notNullValue())
				.body("name", equalTo("Session User")).extract();

		String sessionCookie = response.cookie("PINA_SESSION");
		String csrfCookie = response.cookie("PINA_CSRF");

		given().cookie("PINA_SESSION", sessionCookie).when().get("/api/v1/auth/me").then().statusCode(200).body("name",
				equalTo("Session User"));
		given().cookie("PINA_SESSION", sessionCookie).header("X-CSRF-Token", csrfCookie).contentType(ContentType.JSON)
				.body("{\"name\":\"Updated Session User\"}").when().put("/api/v1/auth/me").then().statusCode(200)
				.body("name", equalTo("Updated Session User"));
	}

	@Test
	void sessionCookiesUseExpectedSecurityFlags() {
		String username = "session-cookie-" + UUID.randomUUID().toString().substring(0, 8);
		ExtractableResponse<Response> response = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"password123\"}").when()
				.post("/api/v1/auth/session/register").then().statusCode(200).extract();

		List<String> setCookieHeaders = response.headers().getValues("Set-Cookie");

		org.hamcrest.MatcherAssert.assertThat(setCookieHeaders, hasItem(containsString("PINA_SESSION=")));
		org.hamcrest.MatcherAssert.assertThat(setCookieHeaders,
				hasItem(containsString("PINA_SESSION=" + response.cookie("PINA_SESSION"))));
		org.hamcrest.MatcherAssert.assertThat(setCookieHeaders, hasItem(containsString("HttpOnly")));
		org.hamcrest.MatcherAssert.assertThat(setCookieHeaders, hasItem(containsString("SameSite=Lax")));
		org.hamcrest.MatcherAssert.assertThat(setCookieHeaders, hasItem(containsString("PINA_CSRF=")));
		org.hamcrest.MatcherAssert.assertThat(setCookieHeaders,
				hasItem(not(containsString("PINA_CSRF=" + response.cookie("PINA_CSRF") + "; HttpOnly"))));
	}

	@Test
	void mutatingSessionRequestRequiresCsrfToken() {
		String username = "session-csrf-" + UUID.randomUUID().toString().substring(0, 8);
		given().contentType(ContentType.JSON).body("{\"username\":\"" + username + "\",\"password\":\"password123\"}")
				.when().post("/api/v1/auth/register").then().statusCode(201);

		ExtractableResponse<Response> response = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"password123\"}").when()
				.post("/api/v1/auth/session/login").then().statusCode(200).extract();

		String sessionCookie = response.cookie("PINA_SESSION");

		given().cookie("PINA_SESSION", sessionCookie).contentType(ContentType.JSON)
				.body("{\"name\":\"Blocked Update\"}").when().put("/api/v1/auth/me").then().statusCode(403)
				.body("error", equalTo("forbidden"));
	}

	@Test
	void sessionLogoutWithoutCsrfTokenIsForbidden() {
		String username = "session-logout-csrf-" + UUID.randomUUID().toString().substring(0, 8);
		given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"password123\",\"name\":\"CSRF Test\"}").when()
				.post("/api/v1/auth/session/register").then().statusCode(200);

		ExtractableResponse<Response> loginResponse = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"password123\"}").when()
				.post("/api/v1/auth/session/login").then().statusCode(200).extract();

		String sessionCookie = loginResponse.cookie("PINA_SESSION");

		// POST logout without CSRF token should be rejected
		given().cookie("PINA_SESSION", sessionCookie).when().post("/api/v1/auth/session/logout").then().statusCode(403)
				.body("error", equalTo("forbidden"));

		// Session should still be active (logout was blocked)
		given().cookie("PINA_SESSION", sessionCookie).when().get("/api/v1/auth/me").then().statusCode(200);
	}

	@Test
	void sessionLogoutRevokesActiveSession() {
		String username = "session-logout-" + UUID.randomUUID().toString().substring(0, 8);
		given().contentType(ContentType.JSON).body("{\"username\":\"" + username + "\",\"password\":\"password123\"}")
				.when().post("/api/v1/auth/register").then().statusCode(201);

		ExtractableResponse<Response> response = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"password123\"}").when()
				.post("/api/v1/auth/session/login").then().statusCode(200).extract();

		String sessionCookie = response.cookie("PINA_SESSION");
		String csrfCookie = response.cookie("PINA_CSRF");

		given().cookie("PINA_SESSION", sessionCookie).header("X-CSRF-Token", csrfCookie).when()
				.post("/api/v1/auth/session/logout").then().statusCode(204);

		given().cookie("PINA_SESSION", sessionCookie).when().get("/api/v1/auth/me").then().statusCode(401);
	}

	@Test
	void meBehavesTheSameForBearerAndSessionAuthentication() {
		String username = "session-parity-" + UUID.randomUUID().toString().substring(0, 8);
		ExtractableResponse<Response> registerResponse = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"password123\"}").when()
				.post("/api/v1/auth/register").then().statusCode(201).extract();
		String accessToken = registerResponse.path("accessToken");

		ExtractableResponse<Response> sessionResponse = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"password123\"}").when()
				.post("/api/v1/auth/session/login").then().statusCode(200).extract();

		String sessionCookie = sessionResponse.cookie("PINA_SESSION");
		String bearerUserId = given().header("Authorization", "Bearer " + accessToken).when().get("/api/v1/auth/me")
				.then().statusCode(200).extract().path("id");
		String sessionUserId = given().cookie("PINA_SESSION", sessionCookie).when().get("/api/v1/auth/me").then()
				.statusCode(200).extract().path("id");

		org.junit.jupiter.api.Assertions.assertEquals(bearerUserId, sessionUserId);
	}

	@Test
	void allowedFrontendOriginReceivesCredentialedCorsHeaders() {
		given().header("Origin", "http://localhost:5173").header("Access-Control-Request-Method", "POST")
				.header("Access-Control-Request-Headers", "Content-Type,X-CSRF-Token").when()
				.options("/api/v1/auth/session/login").then().statusCode(200)
				.header("Access-Control-Allow-Origin", equalTo("http://localhost:5173"))
				.header("Access-Control-Allow-Credentials", equalTo("true"));
	}

	@Test
	void sessionLoginStoresProvenanceUsingTrustedRemoteAddressSource() {
		String username = "session-ip-metadata-" + UUID.randomUUID().toString().substring(0, 8);
		String spoofedForwardedFor = "203.0.113.77, 198.51.100.10";

		given().contentType(ContentType.JSON).body("{\"username\":\"" + username + "\",\"password\":\"password123\"}")
				.when().post("/api/v1/auth/register").then().statusCode(201);

		ExtractableResponse<Response> response = given().header("User-Agent", "Metadata Browser/1.0")
				.header("X-Forwarded-For", spoofedForwardedFor).contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"password123\"}").when()
				.post("/api/v1/auth/session/login").then().statusCode(200).extract();

		String userId = response.path("id");
		BrowserSession session = latestSessionForUser(userId);

		assertNotNull(session.userAgentHash);
		assertNotNull(session.ipHash);
		assertNotEquals(sha256(spoofedForwardedFor), session.ipHash);
	}

	@Test
	void sessionAuthenticationIsNotBoundToStoredUserAgentHash() {
		String username = "session-ua-not-bound-" + UUID.randomUUID().toString().substring(0, 8);
		given().contentType(ContentType.JSON).body("{\"username\":\"" + username + "\",\"password\":\"password123\"}")
				.when().post("/api/v1/auth/register").then().statusCode(201);

		ExtractableResponse<Response> response = given().header("User-Agent", "Original Browser/1.0")
				.contentType(ContentType.JSON).body("{\"username\":\"" + username + "\",\"password\":\"password123\"}")
				.when().post("/api/v1/auth/session/login").then().statusCode(200).extract();

		String sessionCookie = response.cookie("PINA_SESSION");

		given().header("User-Agent", "Different Browser/2.0").cookie("PINA_SESSION", sessionCookie).when()
				.get("/api/v1/auth/me").then().statusCode(200);
	}

	@Test
	void deactivatedUserCannotContinueBrowserSession() throws Exception {
		String username = "session-inactive-" + UUID.randomUUID().toString().substring(0, 8);
		ExtractableResponse<Response> response = given().contentType(ContentType.JSON)
				.body("{\"username\":\"" + username + "\",\"password\":\"password123\"}").when()
				.post("/api/v1/auth/session/register").then().statusCode(200).extract();

		String sessionCookie = response.cookie("PINA_SESSION");
		String userId = response.path("id");

		deactivateUser(userId);

		given().cookie("PINA_SESSION", sessionCookie).when().get("/api/v1/auth/me").then().statusCode(401);
	}

	private BrowserSession latestSessionForUser(String userId) {
		return em
				.createQuery("SELECT bs FROM BrowserSession bs WHERE bs.user.id = :userId ORDER BY bs.createdAt DESC",
						BrowserSession.class)
				.setParameter("userId", UUID.fromString(userId)).setMaxResults(1).getSingleResult();
	}

	private String sha256(String value) {
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
			return java.util.HexFormat.of().formatHex(digest);
		} catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException("SHA-256 not available", e);
		}
	}

	private void deactivateUser(String userId) throws Exception {
		tx.begin();
		em.createQuery("UPDATE User u SET u.active = false WHERE u.id = :id").setParameter("id", UUID.fromString(userId))
				.executeUpdate();
		tx.commit();
	}
}
