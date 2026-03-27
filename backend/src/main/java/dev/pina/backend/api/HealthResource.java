package dev.pina.backend.api;

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

	@GET
	public Response health() {
		var body = new LinkedHashMap<String, Object>();
		try {
			var stats = storage.stats();
			body.put("status", "ok");
			body.put("storage", Map.of("type", storage.type(), "usedBytes", stats.usedBytes(), "availableBytes",
					stats.availableBytes()));
			return Response.ok(body).build();
		} catch (Exception _) {
			body.put("status", "down");
			body.put("storage", Map.of("type", storage.type(), "error", "unavailable"));
			return Response.status(Response.Status.SERVICE_UNAVAILABLE).entity(body).build();
		}
	}
}
