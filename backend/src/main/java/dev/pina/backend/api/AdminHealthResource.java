package dev.pina.backend.api;

import dev.pina.backend.api.dto.AdminHealthDto;
import dev.pina.backend.config.MlConfig;
import dev.pina.backend.service.UserResolver;
import dev.pina.backend.storage.StorageProvider;
import dev.pina.backend.storage.StorageStats;
import dev.pina.ml.v1.GetServiceStatusRequest;
import dev.pina.ml.v1.GetServiceStatusResponse;
import io.quarkus.grpc.GrpcClient;
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
import java.time.Duration;
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

	@Inject
	MlConfig mlConfig;

	@GrpcClient("ml")
	dev.pina.ml.v1.ImageAnalysis mlClient;

	@ConfigProperty(name = "quarkus.application.version", defaultValue = "unknown")
	String appVersion;

	private static final Duration ML_STATUS_TIMEOUT = Duration.ofSeconds(2);

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

		return Response.ok(new AdminHealthDto("UP", appVersion, dbHealth, storageHealth, jvmHealth, mlHealth()))
				.build();
	}

	private AdminHealthDto.MlHealth mlHealth() {
		if (!mlConfig.enabled()) {
			return new AdminHealthDto.MlHealth(false, false, null, false, 0, 0);
		}
		try {
			GetServiceStatusResponse status = mlClient.getServiceStatus(GetServiceStatusRequest.getDefaultInstance())
					.await().atMost(ML_STATUS_TIMEOUT);
			int available = (int) status.getModelsList().stream().filter(dev.pina.ml.v1.ModelAvailability::getAvailable)
					.count();
			return new AdminHealthDto.MlHealth(true, true, status.getActiveProfile(), status.getReady(), available,
					status.getModelsCount());
		} catch (RuntimeException _) {
			return new AdminHealthDto.MlHealth(true, false, null, false, 0, 0);
		}
	}
}
