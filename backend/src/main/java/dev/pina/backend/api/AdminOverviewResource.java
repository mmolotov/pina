package dev.pina.backend.api;

import dev.pina.backend.service.AdminOverviewService;
import dev.pina.backend.service.UserResolver;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/admin/overview")
@Produces(MediaType.APPLICATION_JSON)
public class AdminOverviewResource {

	@Inject
	UserResolver userResolver;

	@Inject
	AdminOverviewService adminOverviewService;

	@GET
	public Response overview() {
		userResolver.requireAdmin();
		return Response.ok(adminOverviewService.getOverview()).build();
	}
}
