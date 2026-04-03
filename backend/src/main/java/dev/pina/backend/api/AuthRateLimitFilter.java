package dev.pina.backend.api;

import dev.pina.backend.api.error.ApiErrors;
import dev.pina.backend.service.AuthRateLimitService;
import dev.pina.backend.service.BrowserSessionService;
import io.vertx.ext.web.RoutingContext;
import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.ws.rs.HttpMethod;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import java.util.Set;

@Provider
@Priority(Priorities.AUTHENTICATION - 10)
public class AuthRateLimitFilter implements ContainerRequestFilter {

	private static final Set<String> THROTTLED_PATHS = Set.of("/api/v1/auth/register", "/api/v1/auth/login",
			"/api/v1/auth/session/register", "/api/v1/auth/session/login", "/api/v1/auth/google",
			"/api/v1/auth/refresh");

	@Inject
	AuthRateLimitService authRateLimitService;

	@Inject
	RoutingContext routingContext;

	@Inject
	BrowserSessionService browserSessionService;

	@Override
	public void filter(ContainerRequestContext requestContext) {
		if (!HttpMethod.POST.equals(requestContext.getMethod())) {
			return;
		}

		String path = requestContext.getUriInfo().getPath();
		if (!path.startsWith("/")) {
			path = "/" + path;
		}
		if (!THROTTLED_PATHS.contains(path)) {
			return;
		}

		String clientKey = path + "|" + resolveClientIdentifier(requestContext);
		var decision = authRateLimitService.check(clientKey);
		if (decision.allowed()) {
			return;
		}

		requestContext.abortWith(Response.fromResponse(ApiErrors.tooManyRequests("Too many authentication attempts"))
				.header(HttpHeaders.RETRY_AFTER, decision.retryAfterSeconds()).build());
	}

	private String resolveClientIdentifier(ContainerRequestContext requestContext) {
		// Use Vert.x remote address — when proxy-address-forwarding is enabled,
		// Quarkus resolves this from X-Forwarded-For only if the proxy is trusted.
		String remoteAddress = browserSessionService.resolveTrustedRemoteAddress(routingContext);
		return remoteAddress != null ? remoteAddress : "unknown";
	}
}
