package dev.pina.backend.api;

import dev.pina.backend.api.dto.PageResponse;
import dev.pina.backend.api.error.ApiErrors;
import dev.pina.backend.pagination.PageRequest;
import dev.pina.backend.service.AdminSpaceService;
import dev.pina.backend.service.UserResolver;
import jakarta.inject.Inject;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.UUID;
import org.jboss.logging.Logger;

@Path("/api/v1/admin/spaces")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AdminSpaceResource {

	private static final Logger LOG = Logger.getLogger(AdminSpaceResource.class);

	@Inject
	UserResolver userResolver;

	@Inject
	AdminSpaceService adminSpaceService;

	@GET
	public Response list(@QueryParam("page") @DefaultValue("0") @Min(0) int page,
			@QueryParam("size") @DefaultValue("50") @Positive int size,
			@QueryParam("needsTotal") @DefaultValue("false") boolean needsTotal,
			@QueryParam("search") @Size(max = 200) String search) {
		userResolver.requireAdmin();
		var result = adminSpaceService.listSpaces(new PageRequest(page, size, needsTotal), search);
		return Response.ok(PageResponse.from(result, dto -> dto)).build();
	}

	@GET
	@Path("/{id}")
	public Response getById(@PathParam("id") UUID id) {
		userResolver.requireAdmin();
		return adminSpaceService.findById(id).map(dto -> Response.ok(dto).build())
				.orElse(ApiErrors.notFound("Space not found"));
	}

	@DELETE
	@Path("/{id}")
	public Response delete(@PathParam("id") UUID id) {
		var admin = userResolver.requireAdmin();
		if (adminSpaceService.forceDelete(id)) {
			LOG.infof("Admin %s force-deleted space %s", admin.id, id);
			return Response.noContent().build();
		}
		return ApiErrors.notFound("Space not found");
	}
}
