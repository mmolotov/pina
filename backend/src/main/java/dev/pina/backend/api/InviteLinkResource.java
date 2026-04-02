package dev.pina.backend.api;

import dev.pina.backend.api.dto.InviteLinkInfoDto;
import dev.pina.backend.api.error.ApiErrors;
import dev.pina.backend.service.InviteLinkService;
import dev.pina.backend.service.UserResolver;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/invites")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class InviteLinkResource {

	@Inject
	InviteLinkService inviteLinkService;

	@Inject
	UserResolver userResolver;

	@GET
	@Path("/{code}")
	public Response preview(@PathParam("code") String code) {
		return inviteLinkService.findPreviewableByCode(code)
				.map(link -> Response.ok(InviteLinkInfoDto.from(link)).build())
				.orElse(ApiErrors.notFound("Invite not found"));
	}

	@POST
	@Path("/{code}/join")
	@Consumes(MediaType.WILDCARD)
	public Response join(@PathParam("code") String code) {
		var user = userResolver.currentUser();
		return switch (inviteLinkService.join(code, user)) {
			case JOINED -> Response.ok().build();
			case ALREADY_MEMBER -> Response.ok().build();
			case INVALID -> ApiErrors.notFound("Invite not found");
		};
	}
}
