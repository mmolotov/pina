package dev.pina.backend.api;

import dev.pina.backend.api.dto.AlbumDto;
import dev.pina.backend.api.dto.CreateAlbumRequest;
import dev.pina.backend.api.dto.PageResponse;
import dev.pina.backend.api.dto.PhotoDto;
import dev.pina.backend.api.error.ApiErrors;
import dev.pina.backend.pagination.PageRequest;
import dev.pina.backend.service.AlbumService;
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
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.UUID;

@Path("/api/v1/albums")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AlbumResource {

	public static final String ALBUM_NOT_FOUND = "Album not found: ";
	@Inject
	AlbumService albumService;

	@Inject
	UserResolver userResolver;

	@POST
	public Response create(@Valid CreateAlbumRequest request) {
		var user = userResolver.currentUser();
		var album = albumService.create(request.name(), request.description(), user);
		return Response.status(Response.Status.CREATED).entity(AlbumDto.from(album)).build();
	}

	// TODO Phase 2: all album operations must verify ownership/membership
	@GET
	public Response list() {
		var user = userResolver.currentUser();
		var albums = albumService.listByOwner(user.id).stream().map(AlbumDto::from).toList();
		return Response.ok(albums).build();
	}

	@GET
	@Path("/{id}/photos")
	public Response listPhotos(@PathParam("id") UUID id, @QueryParam("page") @DefaultValue("0") @Min(0) int page,
			@QueryParam("size") @DefaultValue("50") @Positive int size,
			@QueryParam("needsTotal") @DefaultValue("false") boolean needsTotal) {
		return albumService.findById(id).map(_ -> {
			var photos = albumService.listPhotos(id, new PageRequest(page, size, needsTotal));
			return Response.ok(PageResponse.from(photos, PhotoDto::from)).build();
		}).orElse(ApiErrors.notFound(ALBUM_NOT_FOUND + id));
	}

	@PUT
	@Path("/{id}")
	public Response update(@PathParam("id") UUID id, @Valid CreateAlbumRequest request) {
		return albumService.update(id, request.name(), request.description())
				.map(album -> Response.ok(AlbumDto.from(album)).build())
				.orElse(ApiErrors.notFound(ALBUM_NOT_FOUND + id));
	}

	@POST
	@Path("/{id}/photos/{photoId}")
	@Consumes(MediaType.WILDCARD)
	public Response addPhoto(@PathParam("id") UUID id, @PathParam("photoId") UUID photoId) {
		return switch (albumService.addPhoto(id, photoId, userResolver.currentUser())) {
			case CREATED -> Response.status(Response.Status.CREATED).build();
			case ALREADY_EXISTS -> Response.ok().build();
			case NOT_FOUND -> ApiErrors.notFound("Album or photo not found");
		};
	}

	@DELETE
	@Path("/{id}/photos/{photoId}")
	@Consumes(MediaType.WILDCARD)
	public Response removePhoto(@PathParam("id") UUID id, @PathParam("photoId") UUID photoId) {
		if (albumService.removePhoto(id, photoId)) {
			return Response.noContent().build();
		}
		return ApiErrors.notFound("Album photo reference not found");
	}

	@DELETE
	@Path("/{id}")
	public Response delete(@PathParam("id") UUID id) {
		if (albumService.delete(id)) {
			return Response.noContent().build();
		}
		return ApiErrors.notFound(ALBUM_NOT_FOUND + id);
	}
}
