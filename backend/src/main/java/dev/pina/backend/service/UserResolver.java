package dev.pina.backend.service;

import dev.pina.backend.api.dto.UpdateProfileRequest;
import dev.pina.backend.domain.InstanceRole;
import dev.pina.backend.domain.User;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.PersistenceException;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.util.UUID;
import org.eclipse.microprofile.jwt.JsonWebToken;

@ApplicationScoped
public class UserResolver {

	@Inject
	SecurityIdentity securityIdentity;

	public User currentUser() {
		if (securityIdentity == null || securityIdentity.isAnonymous()) {
			throw new WebApplicationException(Response.Status.UNAUTHORIZED);
		}

		String subject = resolveSubject();
		if (subject == null) {
			throw new WebApplicationException(Response.Status.UNAUTHORIZED);
		}
		UUID userId = UUID.fromString(subject);
		User user = User.findById(userId);
		if (user == null) {
			throw new WebApplicationException(Response.Status.UNAUTHORIZED);
		}
		if (!user.active) {
			throw new WebApplicationException(Response.Status.UNAUTHORIZED);
		}
		return user;
	}

	public User requireAdmin() {
		User user = currentUser();
		if (user.instanceRole != InstanceRole.ADMIN) {
			throw new WebApplicationException(Response.Status.FORBIDDEN);
		}
		return user;
	}

	public String currentAuthMethod() {
		if (securityIdentity == null || securityIdentity.isAnonymous()) {
			throw new WebApplicationException(Response.Status.UNAUTHORIZED);
		}
		String authMethod = securityIdentity.getAttribute(BrowserSessionService.AUTH_METHOD_ATTRIBUTE);
		return authMethod != null ? authMethod : BrowserSessionService.AUTH_METHOD_BEARER;
	}

	public String currentSessionId() {
		if (securityIdentity == null || securityIdentity.isAnonymous()) {
			return null;
		}
		return securityIdentity.getAttribute(BrowserSessionService.SESSION_ID_ATTRIBUTE);
	}

	@Transactional
	public User updateProfile(UpdateProfileRequest request) {
		User user = currentUser();
		if (request.name() != null && !request.name().isBlank()) {
			user.name = request.name();
		}
		if (request.email() != null) {
			if (request.email().isBlank()) {
				user.email = null;
			} else {
				long count = User.count("email = ?1 and id != ?2", request.email(), user.id);
				if (count > 0) {
					throw new EmailAlreadyExistsException();
				}
				user.email = request.email();
			}
		}
		try {
			user.persistAndFlush();
		} catch (PersistenceException _) {
			User.getEntityManager().clear();
			throw new EmailAlreadyExistsException();
		}
		return user;
	}

	private String resolveSubject() {
		var principal = securityIdentity.getPrincipal();
		if (principal instanceof JsonWebToken jsonWebToken && jsonWebToken.getSubject() != null) {
			return jsonWebToken.getSubject();
		}
		return principal != null ? principal.getName() : null;
	}
}
