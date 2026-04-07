package dev.pina.backend.service;

import at.favre.lib.crypto.bcrypt.BCrypt;
import dev.pina.backend.domain.AuthProvider;
import dev.pina.backend.domain.BrowserSessionType;
import dev.pina.backend.domain.InstanceRole;
import dev.pina.backend.domain.LinkedAccount;
import dev.pina.backend.domain.RefreshToken;
import dev.pina.backend.domain.RegistrationMode;
import dev.pina.backend.domain.User;
import dev.pina.backend.service.GoogleTokenVerifier.GoogleIdToken;
import io.smallrye.jwt.build.Jwt;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceException;
import jakarta.transaction.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Optional;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class AuthService {

	private static final SecureRandom SECURE_RANDOM = new SecureRandom();
	private static final int REFRESH_TOKEN_BYTES = 32;
	private static final String INSTANCE_ADMIN_BOOTSTRAP_LOCK = "instance-admin-bootstrap";

	@Inject
	PersonalLibraryService personalLibraryService;

	@Inject
	EntityManager em;

	@Inject
	TransactionalLockService lockService;

	@Inject
	BrowserSessionService browserSessionService;

	@Inject
	InstanceSettingsService instanceSettingsService;

	@ConfigProperty(name = "pina.auth.bcrypt.cost", defaultValue = "12")
	int bcryptCost;

	@ConfigProperty(name = "smallrye.jwt.new-token.lifespan", defaultValue = "900")
	long accessTokenLifespan;

	@ConfigProperty(name = "pina.auth.refresh-token.lifespan", defaultValue = "2592000")
	long refreshTokenLifespan;

	@ConfigProperty(name = "pina.admin.initial-username")
	Optional<String> initialUsername;

	@Transactional
	public User register(String username, String password, String name) {
		enforceSelfSignupAllowed();

		lockLinkedAccount(AuthProvider.LOCAL, username);

		long exists = LinkedAccount.count("provider = ?1 and providerAccountId = ?2", AuthProvider.LOCAL, username);
		if (exists > 0) {
			throw new UsernameAlreadyExistsException(username);
		}

		User user = new User();
		user.name = (name != null && !name.isBlank()) ? name : username;
		try {
			user.persistAndFlush();
		} catch (PersistenceException e) {
			User.getEntityManager().clear();
			throw new IllegalStateException("Failed to create user", e);
		}

		LinkedAccount account = new LinkedAccount();
		account.user = user;
		account.provider = AuthProvider.LOCAL;
		account.providerAccountId = username;
		account.credentials = BCrypt.withDefaults().hashToString(bcryptCost, password.toCharArray());
		try {
			account.persistAndFlush();
		} catch (PersistenceException _) {
			LinkedAccount.getEntityManager().clear();
			throw new UsernameAlreadyExistsException(username);
		}

		personalLibraryService.getOrCreate(user);
		promoteInitialAdminIfEligible(user, AuthProvider.LOCAL, username);

		return user;
	}

	public Optional<User> authenticate(String username, String password) {
		LinkedAccount account = LinkedAccount
				.find("provider = ?1 and providerAccountId = ?2", AuthProvider.LOCAL, username).firstResult();
		if (account == null) {
			return Optional.empty();
		}
		if (!account.user.active) {
			return Optional.empty();
		}
		BCrypt.Result result = BCrypt.verifyer().verify(password.toCharArray(), account.credentials);
		if (!result.verified) {
			return Optional.empty();
		}
		return Optional.of(account.user);
	}

	@Transactional
	public User loginWithGoogle(GoogleIdToken googleToken) {
		lockLinkedAccount(AuthProvider.GOOGLE, googleToken.subject());

		LinkedAccount existing = LinkedAccount.getEntityManager().createQuery(
				"SELECT la FROM LinkedAccount la JOIN FETCH la.user WHERE la.provider = :provider AND la.providerAccountId = :accountId",
				LinkedAccount.class).setParameter("provider", AuthProvider.GOOGLE)
				.setParameter("accountId", googleToken.subject()).getResultStream().findFirst().orElse(null);
		if (existing != null) {
			requireActive(existing.user);
			return existing.user;
		}

		enforceSelfSignupAllowed();

		if (googleToken.email() != null && User.count("email", googleToken.email()) > 0) {
			throw new EmailAlreadyExistsException(
					"Email already in use by another account; sign in first and link Google from profile settings");
		}

		User user = new User();
		user.name = googleToken.name() != null ? googleToken.name() : "Google User";
		user.email = googleToken.email();
		user.avatarUrl = googleToken.picture();
		try {
			user.persistAndFlush();
		} catch (PersistenceException e) {
			User.getEntityManager().clear();
			if (googleToken.email() != null && User.count("email", googleToken.email()) > 0) {
				throw new EmailAlreadyExistsException(
						"Email already in use by another account; sign in first and link Google from profile settings");
			}
			throw new IllegalStateException("Failed to create Google-authenticated user", e);
		}

		LinkedAccount account = new LinkedAccount();
		account.user = user;
		account.provider = AuthProvider.GOOGLE;
		account.providerAccountId = googleToken.subject();
		account.persistAndFlush();

		personalLibraryService.getOrCreate(user);
		return user;
	}

	@Transactional
	public void linkGoogleAccount(User user, GoogleIdToken googleToken) {
		lockLinkedAccount(AuthProvider.GOOGLE, googleToken.subject());

		LinkedAccount existing = LinkedAccount.getEntityManager().createQuery(
				"SELECT la FROM LinkedAccount la JOIN FETCH la.user WHERE la.provider = :provider AND la.providerAccountId = :accountId",
				LinkedAccount.class).setParameter("provider", AuthProvider.GOOGLE)
				.setParameter("accountId", googleToken.subject()).getResultStream().findFirst().orElse(null);
		if (existing != null) {
			if (existing.user.id.equals(user.id)) {
				return;
			}
			throw new IllegalArgumentException("Google account already linked to another user");
		}

		LinkedAccount account = new LinkedAccount();
		account.user = user;
		account.provider = AuthProvider.GOOGLE;
		account.providerAccountId = googleToken.subject();
		account.persistAndFlush();
	}

	public String generateAccessToken(User user) {
		return Jwt.subject(user.id.toString()).claim("name", user.name).claim("instanceRole", user.instanceRole.name())
				.sign();
	}

	public long getAccessTokenLifespan() {
		return accessTokenLifespan;
	}

	@Transactional
	public String createRefreshToken(User user) {
		byte[] randomBytes = new byte[REFRESH_TOKEN_BYTES];
		SECURE_RANDOM.nextBytes(randomBytes);
		String rawToken = HexFormat.of().formatHex(randomBytes);

		RefreshToken refreshToken = new RefreshToken();
		refreshToken.user = user;
		refreshToken.tokenHash = hashToken(rawToken);
		refreshToken.expiresAt = OffsetDateTime.now().plusSeconds(refreshTokenLifespan);
		refreshToken.revoked = false;
		refreshToken.persistAndFlush();

		return rawToken;
	}

	@Transactional
	public Optional<TokenPair> refresh(String rawRefreshToken) {
		String hash = hashToken(rawRefreshToken);
		RefreshToken existing = findRefreshTokenForMutation(hash);
		if (existing == null || existing.revoked || existing.expiresAt.isBefore(OffsetDateTime.now())) {
			return Optional.empty();
		}

		if (!existing.user.active) {
			existing.revoked = true;
			existing.persistAndFlush();
			return Optional.empty();
		}

		existing.revoked = true;
		existing.persistAndFlush();

		User user = existing.user;
		String newAccessToken = generateAccessToken(user);
		String newRefreshToken = createRefreshToken(user);
		return Optional.of(new TokenPair(newAccessToken, newRefreshToken, user));
	}

	@Transactional
	public boolean logout(String rawRefreshToken) {
		String hash = hashToken(rawRefreshToken);
		RefreshToken existing = findRefreshTokenForMutation(hash);
		if (existing == null || existing.revoked) {
			return false;
		}
		existing.revoked = true;
		existing.persistAndFlush();
		return true;
	}

	@Transactional
	public BrowserSessionService.BrowserSessionTokens createBrowserSession(User user, BrowserSessionType sessionType,
			String userAgent, String remoteAddress) {
		requireActive(user);
		return browserSessionService.createBrowserSession(user, sessionType, userAgent, remoteAddress);
	}

	@Transactional
	public boolean logoutBrowserSession(String rawSessionToken) {
		return browserSessionService.revoke(rawSessionToken);
	}

	public record TokenPair(String accessToken, String refreshToken, User user) {
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

	private void lockLinkedAccount(AuthProvider provider, String providerAccountId) {
		lockService.lock("linked-account", provider.name() + ":" + providerAccountId);
	}

	private void enforceSelfSignupAllowed() {
		RegistrationMode mode = instanceSettingsService.getRegistrationMode();
		if (mode == RegistrationMode.CLOSED || mode == RegistrationMode.INVITE_ONLY) {
			throw new RegistrationClosedException();
		}
	}

	private void requireActive(User user) {
		if (!user.active) {
			throw new InactiveUserException();
		}
	}

	private void promoteInitialAdminIfEligible(User user, AuthProvider provider, String providerAccountId) {
		if (provider != AuthProvider.LOCAL) {
			return;
		}
		lockService.lock(INSTANCE_ADMIN_BOOTSTRAP_LOCK);
		long adminCount = User.count("instanceRole", InstanceRole.ADMIN);
		if (adminCount > 0) {
			return;
		}

		String configuredUsername = initialUsername.map(String::trim).filter(value -> !value.isBlank()).orElse(null);
		if (configuredUsername != null && !configuredUsername.equals(providerAccountId)) {
			return;
		}

		user.instanceRole = InstanceRole.ADMIN;
		user.persistAndFlush();
	}

	private RefreshToken findRefreshTokenForMutation(String tokenHash) {
		return em
				.createQuery("SELECT rt FROM RefreshToken rt JOIN FETCH rt.user WHERE rt.tokenHash = :tokenHash",
						RefreshToken.class)
				.setParameter("tokenHash", tokenHash).setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultStream()
				.findFirst().orElse(null);
	}
}
