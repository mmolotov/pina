package dev.pina.backend.service;

import dev.pina.backend.api.dto.AdminOverviewDto;
import dev.pina.backend.api.dto.AdminStorageSummaryDto;
import dev.pina.backend.domain.InstanceRole;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Composes the admin Overview snapshot from headline counts
 * (users/spaces/invites), the storage rollup, and a compact runtime state.
 * Keeps the REST resource thin.
 */
@ApplicationScoped
public class AdminOverviewService {

	@Inject
	EntityManager em;

	@Inject
	AdminStorageService storageService;

	@ConfigProperty(name = "quarkus.application.version", defaultValue = "unknown")
	String appVersion;

	public AdminOverviewDto getOverview() {
		long totalUsers = count("SELECT COUNT(u) FROM User u");
		long activeUsers = count("SELECT COUNT(u) FROM User u WHERE u.active = true");
		long adminUsers = em.createQuery("SELECT COUNT(u) FROM User u WHERE u.instanceRole = :role", Long.class)
				.setParameter("role", InstanceRole.ADMIN).getSingleResult();
		long totalSpaces = count("SELECT COUNT(s) FROM Space s");
		long activeInvites = count("SELECT COUNT(il) FROM InviteLink il WHERE il.active = true");

		AdminStorageSummaryDto storage = storageService.getSummary();

		boolean databaseConnected;
		try {
			em.createNativeQuery("SELECT 1").getSingleResult();
			databaseConnected = true;
		} catch (PersistenceException _) {
			databaseConnected = false;
		}

		Runtime runtime = Runtime.getRuntime();
		long jvmHeapUsedBytes = runtime.totalMemory() - runtime.freeMemory();
		long jvmHeapMaxBytes = runtime.maxMemory();

		return new AdminOverviewDto(totalUsers, activeUsers, adminUsers, totalSpaces, activeInvites,
				storage.totalPhotos(), storage.totalVariants(), storage.totalStorageBytes(),
				storage.filesystemUsedBytes(), storage.filesystemAvailableBytes(), storage.storageProvider(), "UP",
				appVersion, databaseConnected, jvmHeapUsedBytes, jvmHeapMaxBytes);
	}

	private long count(String jpql) {
		return em.createQuery(jpql, Long.class).getSingleResult();
	}
}
