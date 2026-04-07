package dev.pina.backend.service;

import dev.pina.backend.domain.AuthProvider;
import dev.pina.backend.domain.InstanceRole;
import dev.pina.backend.domain.LinkedAccount;
import dev.pina.backend.domain.User;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.transaction.Transactional;
import java.util.Optional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

@ApplicationScoped
public class AdminBootstrap {

	private static final Logger LOG = Logger.getLogger(AdminBootstrap.class);

	@ConfigProperty(name = "pina.admin.initial-username")
	Optional<String> initialUsername;

	@Transactional
	void onStartup(@Observes StartupEvent event) {
		long adminCount = User.count("instanceRole", InstanceRole.ADMIN);
		if (adminCount > 0) {
			return;
		}

		String configuredUsername = initialUsername.map(String::trim).filter(value -> !value.isBlank()).orElse(null);
		if (configuredUsername != null) {
			LinkedAccount account = LinkedAccount
					.find("provider = ?1 and providerAccountId = ?2", AuthProvider.LOCAL, configuredUsername)
					.firstResult();
			if (account != null) {
				account.user.instanceRole = InstanceRole.ADMIN;
				account.user.persistAndFlush();
				LOG.infof("Promoted user '%s' to instance admin via pina.admin.initial-username", configuredUsername);
				return;
			}
			LOG.warnf(
					"pina.admin.initial-username='%s' configured but no matching local user found; that account will be promoted when it is created",
					configuredUsername);
		}
	}
}
