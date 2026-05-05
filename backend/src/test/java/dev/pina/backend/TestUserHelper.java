package dev.pina.backend;

import at.favre.lib.crypto.bcrypt.BCrypt;
import dev.pina.backend.domain.AuthProvider;
import dev.pina.backend.domain.LinkedAccount;
import dev.pina.backend.domain.PersonalLibrary;
import dev.pina.backend.domain.User;
import io.quarkus.narayana.jta.QuarkusTransaction;
import java.util.UUID;

/**
 * Creates test users directly in the database, bypassing HTTP auth. Use in
 * service-level tests that need a User entity without JWT context.
 */
public final class TestUserHelper {

	private TestUserHelper() {
	}

	public static User createUser(String suffix) {
		String unique = suffix + "-" + UUID.randomUUID().toString().substring(0, 8);

		return QuarkusTransaction.requiringNew().call(() -> {
			User user = new User();
			user.name = "Test " + unique;
			user.persistAndFlush();

			LinkedAccount account = new LinkedAccount();
			account.user = user;
			account.provider = AuthProvider.LOCAL;
			account.providerAccountId = unique;
			account.credentials = BCrypt.withDefaults().hashToString(4, "testpass".toCharArray());
			account.persistAndFlush();

			PersonalLibrary library = new PersonalLibrary();
			library.owner = user;
			library.persistAndFlush();

			return user;
		});
	}
}
