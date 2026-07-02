package dev.pina.backend.api;

import dev.pina.backend.api.dto.TrashMutationRequest;
import dev.pina.backend.api.error.ApiErrors;
import dev.pina.backend.service.TrashService;
import dev.pina.backend.service.UserResolver;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.UUID;

@Path("/api/v1/trash")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class TrashResource {

	@Inject
	TrashService trashService;

	@Inject
	UserResolver userResolver;

	@GET
	public Response list(@QueryParam("kind") @DefaultValue("all") String kind,
			@QueryParam("sort") @DefaultValue("deleted") String sort) {
		var user = userResolver.currentUser();
		TrashService.TrashKind trashKind;
		TrashService.TrashSort trashSort;
		try {
			trashKind = TrashService.TrashKind.parse(kind);
			trashSort = TrashService.TrashSort.parse(sort);
		} catch (IllegalArgumentException e) {
			return ApiErrors.badRequest(e.getMessage());
		}
		return Response.ok(trashService.list(user, trashKind, trashSort)).build();
	}

	@POST
	@Path("/restore")
	public Response restore(TrashMutationRequest request) {
		var user = userResolver.currentUser();
		trashService.restore(user, idsOfKind(request, "PHOTO"), idsOfKind(request, "ALBUM"));
		return Response.noContent().build();
	}

	@POST
	@Path("/purge")
	public Response purge(TrashMutationRequest request) {
		var user = userResolver.currentUser();
		trashService.purge(user, idsOfKind(request, "PHOTO"), idsOfKind(request, "ALBUM"));
		return Response.noContent().build();
	}

	@DELETE
	public Response empty() {
		var user = userResolver.currentUser();
		trashService.emptyTrash(user);
		return Response.noContent().build();
	}

	private static List<UUID> idsOfKind(TrashMutationRequest request, String kind) {
		if (request == null || request.items() == null) {
			return List.of();
		}
		return request.items().stream()
				.filter(item -> item != null && item.id() != null && kind.equalsIgnoreCase(item.kind()))
				.map(TrashMutationRequest.Item::id).toList();
	}
}
