package dev.pina.backend.api;

import dev.pina.backend.service.PhotoService;
import dev.pina.backend.storage.StorageProvider;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.LinkedHashMap;
import java.util.Map;

@Path("/api/v1/health")
@Produces(MediaType.APPLICATION_JSON)
public class HealthResource {

	@Inject
	StorageProvider storage;

	@Inject
	PhotoService photoService;

	@GET
	public Response health() {
		var body = new LinkedHashMap<String, Object>();
		try {
			var stats = storage.stats();
			body.put("status", "ok");
			// usedBytes is PINA's stored media (sum of variant sizes), not the whole
			// filesystem; availableBytes stays the backing store's free space.
			body.put("storage", Map.of("type", storage.type(), "usedBytes", photoService.totalStoredBytes(),
					"availableBytes", stats.availableBytes()));
			return Response.ok(body).build();
		} catch (Exception _) {
			body.put("status", "down");
			body.put("storage", Map.of("type", storage.type(), "error", "unavailable"));
			return Response.status(Response.Status.SERVICE_UNAVAILABLE).entity(body).build();
		}
	}
}
