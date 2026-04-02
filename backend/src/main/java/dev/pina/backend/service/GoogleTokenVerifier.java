package dev.pina.backend.service;

import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jose4j.jwk.HttpsJwks;
import org.jose4j.jwt.JwtClaims;
import org.jose4j.jwt.MalformedClaimException;
import org.jose4j.jwt.consumer.InvalidJwtException;
import org.jose4j.jwt.consumer.JwtConsumer;
import org.jose4j.jwt.consumer.JwtConsumerBuilder;
import org.jose4j.keys.resolvers.HttpsJwksVerificationKeyResolver;

@ApplicationScoped
public class GoogleTokenVerifier {

	private static final String GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
	private static final List<String> GOOGLE_ISSUERS = List.of("https://accounts.google.com", "accounts.google.com");
	private final HttpsJwks httpsJwks = new HttpsJwks(GOOGLE_JWKS_URL);
	private final ConcurrentHashMap<String, JwtConsumer> consumers = new ConcurrentHashMap<>();

	@ConfigProperty(name = "pina.auth.google.client-id")
	Optional<String> clientId;

	public record GoogleIdToken(String subject, String email, String name, String picture) {
	}

	public Optional<GoogleIdToken> verify(String idToken) {
		if (clientId.isEmpty()) {
			return Optional.empty();
		}

		try {
			JwtClaims claims = consumerForAudience(clientId.get()).processToClaims(idToken);
			return Optional.of(new GoogleIdToken(claims.getSubject(), claims.getClaimValueAsString("email"),
					claims.getClaimValueAsString("name"), claims.getClaimValueAsString("picture")));
		} catch (InvalidJwtException | MalformedClaimException e) {
			return Optional.empty();
		}
	}

	private JwtConsumer consumerForAudience(String audience) {
		return consumers.computeIfAbsent(audience,
				aud -> new JwtConsumerBuilder().setRequireExpirationTime().setAllowedClockSkewInSeconds(60)
						.setRequireSubject().setExpectedIssuers(true, GOOGLE_ISSUERS.toArray(String[]::new))
						.setExpectedAudience(aud)
						.setVerificationKeyResolver(new HttpsJwksVerificationKeyResolver(httpsJwks)).build());
	}
}
