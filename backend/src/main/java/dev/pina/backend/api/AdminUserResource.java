package dev.pina.backend.api;

import dev.pina.backend.api.dto.AdminUpdateUserRequest;
import dev.pina.backend.api.dto.PageResponse;
import dev.pina.backend.api.error.ApiErrors;
import dev.pina.backend.domain.InstanceRole;
import dev.pina.backend.pagination.PageRequest;
import dev.pina.backend.service.AdminUserService;
import dev.pina.backend.service.UserResolver;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.UUID;
import org.jboss.logging.Logger;

@Path("/api/v1/admin/users")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AdminUserResource {

	private static final Logger LOG = Logger.getLogger(AdminUserResource.class);

	@Inject
	UserResolver userResolver;

	@Inject
	AdminUserService adminUserService;

	@GET
	public Response list(@QueryParam("page") @DefaultValue("0") @Min(0) int page,
			@QueryParam("size") @DefaultValue("50") @Positive int size,
			@QueryParam("needsTotal") @DefaultValue("false") boolean needsTotal,
			@QueryParam("search") @Size(max = 200) String search) {
		userResolver.requireAdmin();
		var result = adminUserService.listUsers(new PageRequest(page, size, needsTotal), search);
		return Response.ok(PageResponse.from(result, dto -> dto)).build();
	}

	@GET
	@Path("/{id}")
	public Response getById(@PathParam("id") UUID id) {
		userResolver.requireAdmin();
		return adminUserService.findById(id).map(dto -> Response.ok(dto).build())
				.orElse(ApiErrors.notFound("User not found"));
	}

	@PUT
	@Path("/{id}")
	public Response update(@PathParam("id") UUID id, @Valid AdminUpdateUserRequest request) {
		var admin = userResolver.requireAdmin();
		if (admin.id.equals(id) && request.instanceRole() != null && request.instanceRole() != InstanceRole.ADMIN) {
			return ApiErrors.badRequest("Cannot demote yourself from admin");
		}
		if (admin.id.equals(id) && request.active() != null && !request.active()) {
			return ApiErrors.badRequest("Cannot deactivate yourself");
		}
		return adminUserService.updateUser(id, request.instanceRole(), request.active()).flatMap(user -> {
			LOG.infof("Admin %s updated user %s: instanceRole=%s, active=%s", admin.id, id, request.instanceRole(),
					request.active());
			return adminUserService.findById(user.id);
		}).map(dto -> Response.ok(dto).build()).orElse(ApiErrors.notFound("User not found"));
	}
}
