package dev.pina.backend.service;

import dev.pina.backend.domain.Album;
import dev.pina.backend.domain.AlbumShareLink;
import dev.pina.backend.domain.User;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class AlbumShareLinkService {

	private static final int TOKEN_BYTES = 32;
	private static final SecureRandom RANDOM = new SecureRandom();
	private static final Base64.Encoder TOKEN_ENCODER = Base64.getUrlEncoder().withoutPadding();

	@Inject
	EntityManager em;

	public record CreatedLink(AlbumShareLink link, String token) {
	}

	@Transactional
	public CreatedLink create(UUID albumId, OffsetDateTime expiresAt, User creator) {
		Album album = Album.findById(albumId);
		if (album == null) {
			throw new IllegalArgumentException("Album not found");
		}
		String token = generateToken();
		AlbumShareLink link = new AlbumShareLink();
		link.album = album;
		link.tokenHash = hashToken(token);
		link.createdBy = creator;
		link.expiresAt = expiresAt;
		link.persistAndFlush();
		return new CreatedLink(link, token);
	}

	public List<AlbumShareLink> listByAlbum(UUID albumId) {
		return em
				.createQuery("SELECT sl FROM AlbumShareLink sl JOIN FETCH sl.album WHERE sl.album.id = :albumId "
						+ "ORDER BY sl.createdAt DESC", AlbumShareLink.class)
				.setParameter("albumId", albumId).getResultList();
	}

	@Transactional
	public boolean revoke(UUID albumId, UUID linkId) {
		return AlbumShareLink.<AlbumShareLink>findByIdOptional(linkId)
				.filter(link -> link.album.id.equals(albumId) && link.revokedAt == null).map(link -> {
					link.revokedAt = OffsetDateTime.now();
					link.persistAndFlush();
					return true;
				}).orElse(false);
	}

	public Optional<AlbumShareLink> findValidByToken(String rawToken) {
		if (rawToken == null || rawToken.isBlank()) {
			return Optional.empty();
		}
		String hash = hashToken(rawToken);
		Optional<AlbumShareLink> found = em
				.createQuery("SELECT sl FROM AlbumShareLink sl JOIN FETCH sl.album WHERE sl.tokenHash = :hash",
						AlbumShareLink.class)
				.setParameter("hash", hash).getResultStream().findFirst();
		return found.filter(link -> isValid(link, OffsetDateTime.now()));
	}

	private boolean isValid(AlbumShareLink link, OffsetDateTime now) {
		if (link.revokedAt != null) {
			return false;
		}
		return link.expiresAt == null || link.expiresAt.isAfter(now);
	}

	private static String generateToken() {
		byte[] bytes = new byte[TOKEN_BYTES];
		RANDOM.nextBytes(bytes);
		return TOKEN_ENCODER.encodeToString(bytes);
	}

	static String hashToken(String token) {
		try {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
			StringBuilder sb = new StringBuilder(hash.length * 2);
			for (byte b : hash) {
				sb.append(String.format("%02x", b));
			}
			return sb.toString();
		} catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException("SHA-256 not available", e);
		}
	}
}
