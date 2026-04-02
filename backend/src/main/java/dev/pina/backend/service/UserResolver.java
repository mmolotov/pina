package dev.pina.backend.service;

import dev.pina.backend.api.dto.UpdateProfileRequest;
import dev.pina.backend.domain.User;
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
	JsonWebToken jwt;

	public User currentUser() {
		String subject = jwt.getSubject();
		if (subject == null) {
			throw new WebApplicationException(Response.Status.UNAUTHORIZED);
		}
		UUID userId = UUID.fromString(subject);
		User user = User.findById(userId);
		if (user == null) {
			throw new WebApplicationException(Response.Status.UNAUTHORIZED);
		}
		return user;
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
}
