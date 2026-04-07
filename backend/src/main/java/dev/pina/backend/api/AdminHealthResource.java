package dev.pina.backend.api;

import dev.pina.backend.api.dto.AdminHealthDto;
import dev.pina.backend.service.UserResolver;
import dev.pina.backend.storage.StorageProvider;
import dev.pina.backend.storage.StorageStats;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.lang.management.ManagementFactory;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@Path("/api/v1/admin/health")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AdminHealthResource {

	@Inject
	UserResolver userResolver;

	@Inject
	EntityManager em;

	@Inject
	StorageProvider storageProvider;

	@ConfigProperty(name = "quarkus.application.version", defaultValue = "unknown")
	String appVersion;

	@GET
	public Response health() {
		userResolver.requireAdmin();

		AdminHealthDto.DatabaseHealth dbHealth;
		try {
			String dbVersion = (String) em.createNativeQuery("SELECT version()").getSingleResult();
			dbHealth = new AdminHealthDto.DatabaseHealth(true, dbVersion);
		} catch (PersistenceException _) {
			dbHealth = new AdminHealthDto.DatabaseHealth(false, null);
		}

		StorageStats fsStats = storageProvider.stats();
		var storageHealth = new AdminHealthDto.StorageHealth(storageProvider.type(), fsStats.usedBytes(),
				fsStats.availableBytes());

		Runtime runtime = Runtime.getRuntime();
		var jvmHealth = new AdminHealthDto.JvmHealth(runtime.totalMemory() - runtime.freeMemory(), runtime.maxMemory(),
				ManagementFactory.getMemoryMXBean().getNonHeapMemoryUsage().getUsed(), runtime.availableProcessors());

		return Response.ok(new AdminHealthDto("UP", appVersion, dbHealth, storageHealth, jvmHealth)).build();
	}
}
