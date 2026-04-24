package dev.pina.backend.service;

import dev.pina.backend.domain.VariantType;
import jakarta.enterprise.context.ApplicationScoped;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class AlbumArchiveDownloadTokenService {

	private static final String HMAC_SHA256 = "HmacSHA256";
	private static final Base64.Encoder TOKEN_ENCODER = Base64.getUrlEncoder().withoutPadding();
	private static final Base64.Decoder TOKEN_DECODER = Base64.getUrlDecoder();

	@ConfigProperty(name = "pina.albums.download-token.signing-key")
	String signingKey;

	@ConfigProperty(name = "pina.albums.download-token.ttl", defaultValue = "PT5M")
	Duration ttl;

	public MintedToken mint(UUID albumId, UUID ownerId, VariantType variantType) {
		return mint(albumId, ownerId, variantType, OffsetDateTime.now(ZoneOffset.UTC).plus(ttl));
	}

	public MintedToken mint(UUID albumId, UUID ownerId, VariantType variantType, OffsetDateTime expiresAt) {
		String payload = "v1:" + albumId + ":" + ownerId + ":" + variantType.name() + ":" + expiresAt.toEpochSecond();
		byte[] payloadBytes = payload.getBytes(StandardCharsets.UTF_8);
		byte[] signature = sign(payloadBytes);
		String token = TOKEN_ENCODER.encodeToString(payloadBytes) + "." + TOKEN_ENCODER.encodeToString(signature);
		return new MintedToken(token, expiresAt);
	}

	public Optional<ValidatedToken> validate(UUID requestedAlbumId, String rawToken) {
		if (rawToken == null || rawToken.isBlank()) {
			return Optional.empty();
		}
		String[] parts = rawToken.split("\\.", 2);
		if (parts.length != 2) {
			return Optional.empty();
		}
		byte[] payloadBytes;
		byte[] actualSignature;
		try {
			payloadBytes = TOKEN_DECODER.decode(parts[0]);
			actualSignature = TOKEN_DECODER.decode(parts[1]);
		} catch (IllegalArgumentException e) {
			return Optional.empty();
		}
		byte[] expectedSignature = sign(payloadBytes);
		if (!MessageDigest.isEqual(expectedSignature, actualSignature)) {
			return Optional.empty();
		}
		String payload = new String(payloadBytes, StandardCharsets.UTF_8);
		String[] fields = payload.split(":", 5);
		if (fields.length != 5 || !"v1".equals(fields[0])) {
			return Optional.empty();
		}
		try {
			UUID albumId = UUID.fromString(fields[1]);
			UUID ownerId = UUID.fromString(fields[2]);
			VariantType variantType = VariantType.valueOf(fields[3]);
			OffsetDateTime expiresAt = OffsetDateTime
					.ofInstant(java.time.Instant.ofEpochSecond(Long.parseLong(fields[4])), ZoneOffset.UTC);
			if (!albumId.equals(requestedAlbumId) || !expiresAt.isAfter(OffsetDateTime.now(ZoneOffset.UTC))) {
				return Optional.empty();
			}
			return Optional.of(new ValidatedToken(albumId, ownerId, variantType, expiresAt));
		} catch (IllegalArgumentException e) {
			return Optional.empty();
		}
	}

	private byte[] sign(byte[] payloadBytes) {
		try {
			Mac mac = Mac.getInstance(HMAC_SHA256);
			mac.init(new SecretKeySpec(signingKey.getBytes(StandardCharsets.UTF_8), HMAC_SHA256));
			return mac.doFinal(payloadBytes);
		} catch (GeneralSecurityException e) {
			throw new IllegalStateException("Unable to sign album download token", e);
		}
	}

	public record MintedToken(String token, OffsetDateTime expiresAt) {
	}

	public record ValidatedToken(UUID albumId, UUID ownerId, VariantType variantType, OffsetDateTime expiresAt) {
	}
}
