package dev.pina.backend.api;

import dev.pina.backend.api.dto.PageResponse;
import dev.pina.backend.api.error.ApiErrors;
import dev.pina.backend.pagination.PageRequest;
import dev.pina.backend.service.AdminInviteService;
import dev.pina.backend.service.UserResolver;
import jakarta.inject.Inject;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
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

@Path("/api/v1/admin/invites")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AdminInviteResource {

	private static final Logger LOG = Logger.getLogger(AdminInviteResource.class);

	@Inject
	UserResolver userResolver;

	@Inject
	AdminInviteService adminInviteService;

	@GET
	public Response list(@QueryParam("page") @DefaultValue("0") @Min(0) int page,
			@QueryParam("size") @DefaultValue("50") @Positive int size,
			@QueryParam("needsTotal") @DefaultValue("false") boolean needsTotal, @QueryParam("spaceId") UUID spaceId,
			@QueryParam("active") Boolean active) {
		userResolver.requireAdmin();
		var result = adminInviteService.listAll(new PageRequest(page, size, needsTotal), spaceId, active);
		return Response.ok(PageResponse.from(result, dto -> dto)).build();
	}

	@DELETE
	@Path("/{id}")
	public Response revoke(@PathParam("id") UUID id) {
		var admin = userResolver.requireAdmin();
		if (adminInviteService.revoke(id)) {
			LOG.infof("Admin %s revoked invite %s", admin.id, id);
			return Response.noContent().build();
		}
		return ApiErrors.notFound("Invite not found");
	}
}
