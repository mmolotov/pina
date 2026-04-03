package dev.pina.backend.api;

import dev.pina.backend.api.dto.CreateFavoriteRequest;
import dev.pina.backend.api.dto.FavoriteDto;
import dev.pina.backend.api.dto.PageResponse;
import dev.pina.backend.api.error.ApiErrors;
import dev.pina.backend.domain.FavoriteTargetType;
import dev.pina.backend.pagination.PageRequest;
import dev.pina.backend.service.FavoriteService;
import dev.pina.backend.service.UserResolver;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.UUID;

@Path("/api/v1/favorites")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class FavoriteResource {

	@Inject
	FavoriteService favoriteService;

	@Inject
	UserResolver userResolver;

	@POST
	public Response add(@Valid CreateFavoriteRequest request) {
		var user = userResolver.currentUser();
		return switch (favoriteService.add(request.targetType(), request.targetId(), user)) {
			case CREATED -> Response.status(Response.Status.CREATED).build();
			case ALREADY_EXISTS -> Response.ok().build();
			case TARGET_NOT_FOUND -> ApiErrors.notFound("Target not found");
		};
	}

	@DELETE
	@Path("/{id}")
	@Consumes(MediaType.WILDCARD)
	public Response remove(@PathParam("id") UUID id) {
		var user = userResolver.currentUser();
		if (favoriteService.remove(id, user.id)) {
			return Response.noContent().build();
		}
		return ApiErrors.notFound("Favorite not found");
	}

	@GET
	public Response list(@QueryParam("type") FavoriteTargetType targetType,
			@QueryParam("page") @DefaultValue("0") @Min(0) int page,
			@QueryParam("size") @DefaultValue("50") @Positive int size,
			@QueryParam("needsTotal") @DefaultValue("false") boolean needsTotal) {
		var user = userResolver.currentUser();
		var favorites = favoriteService.listByUser(user.id, targetType, new PageRequest(page, size, needsTotal));
		return Response.ok(PageResponse.from(favorites, FavoriteDto::from)).build();
	}

	@GET
	@Path("/check")
	public Response check(@QueryParam("targetType") FavoriteTargetType targetType,
			@QueryParam("targetId") UUID targetId) {
		if (targetType == null || targetId == null) {
			return ApiErrors.badRequest("targetType and targetId are required");
		}
		var user = userResolver.currentUser();
		boolean favorited = favoriteService.isFavorited(user.id, targetType, targetId);
		return Response.ok(new CheckResult(favorited)).build();
	}

	record CheckResult(boolean favorited) {
	}
}
