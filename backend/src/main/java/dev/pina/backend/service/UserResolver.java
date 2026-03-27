package dev.pina.backend.service;

import dev.pina.backend.domain.User;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.PersistenceException;
import jakarta.transaction.Transactional;

/**
 * Temporary stub that returns a hardcoded dev user. In Phase 2 this will be
 * replaced with SecurityIdentity / OIDC-based resolution.
 */
@ApplicationScoped
public class UserResolver {

	@Inject
	PersonalLibraryService personalLibraryService;

	private static final String DEV_EMAIL = "admin@pina.dev";
	private static final String DEV_NAME = "Admin";

	@Transactional
	public User currentUser() {
		User user = User.find("email", DEV_EMAIL).firstResult();
		if (user == null) {
			try {
				user = new User();
				user.email = DEV_EMAIL;
				user.name = DEV_NAME;
				user.persistAndFlush();
			} catch (PersistenceException _) {
				User.getEntityManager().clear();
				user = User.find("email", DEV_EMAIL).firstResult();
				if (user == null) {
					throw new IllegalStateException("Dev user creation raced but user was not found");
				}
			}
		}
		personalLibraryService.getOrCreate(user);
		return user;
	}
}
