package dev.pina.backend.service;

import dev.pina.backend.domain.BrowserSession;
import dev.pina.backend.domain.BrowserSessionType;
import dev.pina.backend.domain.User;
import io.vertx.ext.web.RoutingContext;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.context.control.ActivateRequestContext;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.ws.rs.core.NewCookie;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Date;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class BrowserSessionService {

	public static final String AUTH_METHOD_ATTRIBUTE = "auth_method";
	public static final String AUTH_METHOD_BEARER = "BEARER";
	public static final String AUTH_METHOD_SESSION = "SESSION";
	public static final String SESSION_ID_ATTRIBUTE = "session_id";
	public static final String SESSION_TYPE_ATTRIBUTE = "session_type";
	public static final String CSRF_HASH_ATTRIBUTE = "csrf_hash";

	private static final SecureRandom SECURE_RANDOM = new SecureRandom();
	private static final int TOKEN_BYTES = 32;

	@Inject
	EntityManager em;

	@ConfigProperty(name = "pina.auth.browser-session.lifespan", defaultValue = "604800")
	long browserSessionLifespan;

	@ConfigProperty(name = "pina.auth.browser-session.cookie-name", defaultValue = "PINA_SESSION")
	String sessionCookieName;

	@ConfigProperty(name = "pina.auth.browser-session.csrf-cookie-name", defaultValue = "PINA_CSRF")
	String csrfCookieName;

	@ConfigProperty(name = "pina.auth.browser-session.cookie-secure", defaultValue = "false")
	boolean cookieSecure;

	@ConfigProperty(name = "pina.auth.browser-session.cookie-same-site", defaultValue = "LAX")
	String cookieSameSite;

	@ConfigProperty(name = "pina.auth.browser-session.cleanup.revoked-retention", defaultValue = "PT24H")
	java.time.Duration revokedSessionRetention;

	public BrowserSessionTokens createBrowserSession(User user, BrowserSessionType sessionType, String userAgent,
			String remoteAddress) {
		String rawSessionToken = randomToken();
		String rawCsrfToken = randomToken();

		BrowserSession session = new BrowserSession();
		session.user = user;
		session.sessionType = sessionType;
		session.sessionHash = hashToken(rawSessionToken);
		session.csrfTokenHash = hashToken(rawCsrfToken);
		session.userAgentHash = hashNullable(userAgent);
		session.ipHash = hashNullable(remoteAddress);
		session.expiresAt = OffsetDateTime.now().plusSeconds(browserSessionLifespan);
		session.persistAndFlush();

		return new BrowserSessionTokens(session, rawSessionToken, rawCsrfToken);
	}

	@ActivateRequestContext
	public Optional<BrowserSessionAuthentication> authenticate(String rawSessionToken) {
		if (rawSessionToken == null || rawSessionToken.isBlank()) {
			return Optional.empty();
		}

		BrowserSession session = em
				.createQuery("SELECT bs FROM BrowserSession bs JOIN FETCH bs.user WHERE bs.sessionHash = :sessionHash",
						BrowserSession.class)
				.setParameter("sessionHash", hashToken(rawSessionToken)).getResultStream().findFirst().orElse(null);
		if (session == null || session.revokedAt != null || session.expiresAt.isBefore(OffsetDateTime.now())) {
			return Optional.empty();
		}

		return Optional.of(new BrowserSessionAuthentication(session));
	}

	public boolean revoke(String rawSessionToken) {
		if (rawSessionToken == null || rawSessionToken.isBlank()) {
			return false;
		}

		BrowserSession session = em
				.createQuery("SELECT bs FROM BrowserSession bs WHERE bs.sessionHash = :sessionHash",
						BrowserSession.class)
				.setParameter("sessionHash", hashToken(rawSessionToken)).getResultStream().findFirst().orElse(null);
		if (session == null || session.revokedAt != null) {
			return false;
		}

		session.revokedAt = OffsetDateTime.now();
		session.persistAndFlush();
		return true;
	}

	public long purgeExpiredAndRevokedSessions(OffsetDateTime now) {
		OffsetDateTime revokedBefore = now.minus(revokedSessionRetention);
		return em.createQuery(
				"DELETE FROM BrowserSession bs WHERE bs.expiresAt < :now OR (bs.revokedAt IS NOT NULL AND bs.revokedAt < :revokedBefore)")
				.setParameter("now", now).setParameter("revokedBefore", revokedBefore).executeUpdate();
	}

	public boolean isValidCsrfToken(String storedHash, String rawToken) {
		if (storedHash == null || rawToken == null || rawToken.isBlank()) {
			return false;
		}
		byte[] expected = storedHash.getBytes(StandardCharsets.UTF_8);
		byte[] actual = hashToken(rawToken).getBytes(StandardCharsets.UTF_8);
		return MessageDigest.isEqual(expected, actual);
	}

	public String getSessionCookieName() {
		return sessionCookieName;
	}

	public String getCsrfCookieName() {
		return csrfCookieName;
	}

	public String getCsrfHeaderName() {
		return "X-CSRF-Token";
	}

	public NewCookie newSessionCookie(BrowserSessionTokens tokens) {
		return buildCookie(sessionCookieName, tokens.rawSessionToken(), true, tokens.session().expiresAt);
	}

	public NewCookie newCsrfCookie(BrowserSessionTokens tokens) {
		return buildCookie(csrfCookieName, tokens.rawCsrfToken(), false, tokens.session().expiresAt);
	}

	public NewCookie clearSessionCookie() {
		return clearCookie(sessionCookieName, true);
	}

	public NewCookie clearCsrfCookie() {
		return clearCookie(csrfCookieName, false);
	}

	public String resolveTrustedRemoteAddress(RoutingContext routingContext) {
		if (routingContext == null || routingContext.request() == null
				|| routingContext.request().remoteAddress() == null
				|| routingContext.request().remoteAddress().hostAddress() == null) {
			return null;
		}
		return routingContext.request().remoteAddress().hostAddress();
	}

	private String randomToken() {
		byte[] randomBytes = new byte[TOKEN_BYTES];
		SECURE_RANDOM.nextBytes(randomBytes);
		return HexFormat.of().formatHex(randomBytes);
	}

	private String hashNullable(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		return hashToken(value);
	}

	private String hashToken(String rawToken) {
		try {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			byte[] hash = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(hash);
		} catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException("SHA-256 not available", e);
		}
	}

	private NewCookie buildCookie(String name, String value, boolean httpOnly, OffsetDateTime expiresAt) {
		return new NewCookie.Builder(name).value(value).path("/").version(1)
				.maxAge(Math.max(0, (int) browserSessionLifespan)).expiry(Date.from(expiresAt.toInstant()))
				.secure(cookieSecure).httpOnly(httpOnly)
				.sameSite(NewCookie.SameSite.valueOf(cookieSameSite.toUpperCase())).build();
	}

	private NewCookie clearCookie(String name, boolean httpOnly) {
		return new NewCookie.Builder(name).value("").path("/").version(1).maxAge(0).expiry(Date.from(Instant.EPOCH))
				.secure(cookieSecure).httpOnly(httpOnly)
				.sameSite(NewCookie.SameSite.valueOf(cookieSameSite.toUpperCase())).build();
	}

	public record BrowserSessionTokens(BrowserSession session, String rawSessionToken, String rawCsrfToken) {
	}

	public record BrowserSessionAuthentication(BrowserSession session) {

		public UUID userId() {
			return session.user.id;
		}

		public User user() {
			return session.user;
		}
	}
}
