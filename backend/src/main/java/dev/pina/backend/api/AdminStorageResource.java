package dev.pina.backend.api;

import dev.pina.backend.api.dto.PageResponse;
import dev.pina.backend.pagination.PageRequest;
import dev.pina.backend.service.AdminStorageService;
import dev.pina.backend.service.UserResolver;
import jakarta.inject.Inject;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/admin/storage")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AdminStorageResource {

	@Inject
	UserResolver userResolver;

	@Inject
	AdminStorageService adminStorageService;

	@GET
	public Response summary() {
		userResolver.requireAdmin();
		return Response.ok(adminStorageService.getSummary()).build();
	}

	@GET
	@Path("/users")
	public Response perUserBreakdown(@QueryParam("page") @DefaultValue("0") @Min(0) int page,
			@QueryParam("size") @DefaultValue("50") @Positive int size,
			@QueryParam("needsTotal") @DefaultValue("false") boolean needsTotal) {
		userResolver.requireAdmin();
		var result = adminStorageService.perUserBreakdown(new PageRequest(page, size, needsTotal));
		return Response.ok(PageResponse.from(result, dto -> dto)).build();
	}

	@GET
	@Path("/spaces")
	public Response perSpaceBreakdown(@QueryParam("page") @DefaultValue("0") @Min(0) int page,
			@QueryParam("size") @DefaultValue("50") @Positive int size,
			@QueryParam("needsTotal") @DefaultValue("false") boolean needsTotal) {
		userResolver.requireAdmin();
		var result = adminStorageService.perSpaceBreakdown(new PageRequest(page, size, needsTotal));
		return Response.ok(PageResponse.from(result, dto -> dto)).build();
	}
}
