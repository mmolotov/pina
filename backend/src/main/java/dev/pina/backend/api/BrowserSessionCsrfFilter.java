package dev.pina.backend.api;

import dev.pina.backend.api.error.ApiErrors;
import dev.pina.backend.service.BrowserSessionService;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.ext.Provider;
import java.io.IOException;
import java.util.Set;

@Provider
@Priority(Priorities.AUTHORIZATION)
public class BrowserSessionCsrfFilter implements ContainerRequestFilter {

	private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");

	@Inject
	SecurityIdentity securityIdentity;

	@Inject
	BrowserSessionService browserSessionService;

	@Override
	public void filter(ContainerRequestContext requestContext) throws IOException {
		if (SAFE_METHODS.contains(requestContext.getMethod())) {
			return;
		}
		if (securityIdentity == null || securityIdentity.isAnonymous()) {
			return;
		}

		String authMethod = securityIdentity.getAttribute(BrowserSessionService.AUTH_METHOD_ATTRIBUTE);
		if (!BrowserSessionService.AUTH_METHOD_SESSION.equals(authMethod)) {
			return;
		}

		String csrfHash = securityIdentity.getAttribute(BrowserSessionService.CSRF_HASH_ATTRIBUTE);
		String csrfToken = requestContext.getHeaderString(browserSessionService.getCsrfHeaderName());
		if (!browserSessionService.isValidCsrfToken(csrfHash, csrfToken)) {
			requestContext.abortWith(ApiErrors.forbidden("CSRF token is missing or invalid"));
		}
	}
}
