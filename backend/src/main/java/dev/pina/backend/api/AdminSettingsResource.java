package dev.pina.backend.api;

import dev.pina.backend.api.dto.UpdateSettingsRequest;
import dev.pina.backend.api.error.ApiErrors;
import dev.pina.backend.service.InstanceSettingsService;
import dev.pina.backend.service.UserResolver;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

@Path("/api/v1/admin/settings")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AdminSettingsResource {

	private static final Logger LOG = Logger.getLogger(AdminSettingsResource.class);

	@Inject
	UserResolver userResolver;

	@Inject
	InstanceSettingsService settingsService;

	@GET
	public Response getSettings() {
		userResolver.requireAdmin();
		return Response.ok(settingsService.getAll()).build();
	}

	@PUT
	public Response updateSettings(@Valid UpdateSettingsRequest request) {
		var admin = userResolver.requireAdmin();
		try {
			var updated = settingsService.update(request);
			LOG.infof("Admin %s updated instance settings: %s", admin.id, request);
			return Response.ok(updated).build();
		} catch (IllegalArgumentException e) {
			return ApiErrors.badRequest(e.getMessage());
		}
	}
}
