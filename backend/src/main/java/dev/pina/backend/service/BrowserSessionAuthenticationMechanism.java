package dev.pina.backend.service;

import dev.pina.backend.domain.BrowserSessionType;
import io.quarkus.security.identity.IdentityProviderManager;
import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.security.runtime.QuarkusSecurityIdentity;
import io.quarkus.smallrye.jwt.runtime.auth.JWTAuthMechanism;
import io.quarkus.vertx.http.runtime.security.ChallengeData;
import io.quarkus.vertx.http.runtime.security.HttpAuthenticationMechanism;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import io.vertx.ext.web.RoutingContext;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class BrowserSessionAuthenticationMechanism implements HttpAuthenticationMechanism {

	@Inject
	BrowserSessionService browserSessionService;

	@Inject
	JWTAuthMechanism jwtAuthMechanism;

	@Override
	public Uni<SecurityIdentity> authenticate(RoutingContext context, IdentityProviderManager identityProviderManager) {
		if (hasBearerToken(context)) {
			return authenticateBearer(context, identityProviderManager);
		}

		String sessionToken = readCookie(context, browserSessionService.getSessionCookieName());
		if (sessionToken == null || sessionToken.isBlank()) {
			return authenticateBearer(context, identityProviderManager);
		}

		return Uni.createFrom()
				.item(() -> browserSessionService.authenticate(sessionToken).map(this::toSessionIdentity).orElse(null))
				.runSubscriptionOn(Infrastructure.getDefaultExecutor());
	}

	@Override
	public Uni<ChallengeData> getChallenge(RoutingContext context) {
		return jwtAuthMechanism.getChallenge(context);
	}

	@Override
	public int getPriority() {
		return 2000;
	}

	private Uni<SecurityIdentity> authenticateBearer(RoutingContext context,
			IdentityProviderManager identityProviderManager) {
		return jwtAuthMechanism.authenticate(context, identityProviderManager).onItem().ifNotNull()
				.transform(identity -> QuarkusSecurityIdentity.builder(identity).addAttribute(
						BrowserSessionService.AUTH_METHOD_ATTRIBUTE, BrowserSessionService.AUTH_METHOD_BEARER).build());
	}

	private boolean hasBearerToken(RoutingContext context) {
		String authorization = context.request().getHeader("Authorization");
		return authorization != null && authorization.startsWith("Bearer ");
	}

	private String readCookie(RoutingContext context, String name) {
		var cookie = context.request().getCookie(name);
		return cookie != null ? cookie.getValue() : null;
	}

	private SecurityIdentity toSessionIdentity(BrowserSessionService.BrowserSessionAuthentication authentication) {
		BrowserSessionType sessionType = authentication.session().sessionType;
		return QuarkusSecurityIdentity.builder().setPrincipal(new SessionPrincipal(authentication.userId().toString()))
				.addAttribute(BrowserSessionService.AUTH_METHOD_ATTRIBUTE, BrowserSessionService.AUTH_METHOD_SESSION)
				.addAttribute(BrowserSessionService.SESSION_ID_ATTRIBUTE, authentication.session().id.toString())
				.addAttribute(BrowserSessionService.SESSION_TYPE_ATTRIBUTE, sessionType.name())
				.addAttribute(BrowserSessionService.CSRF_HASH_ATTRIBUTE, authentication.session().csrfTokenHash)
				.build();
	}
}
