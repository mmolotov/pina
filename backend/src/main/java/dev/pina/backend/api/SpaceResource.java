package dev.pina.backend.api;

import dev.pina.backend.api.dto.AddMemberRequest;
import dev.pina.backend.api.dto.AlbumDto;
import dev.pina.backend.api.dto.ChangeRoleRequest;
import dev.pina.backend.api.dto.CreateAlbumRequest;
import dev.pina.backend.api.dto.CreateInviteLinkRequest;
import dev.pina.backend.api.dto.CreateSpaceRequest;
import dev.pina.backend.api.dto.InviteLinkDto;
import dev.pina.backend.api.dto.PageResponse;
import dev.pina.backend.api.dto.PhotoDto;
import dev.pina.backend.api.dto.SpaceDto;
import dev.pina.backend.api.dto.SpaceMemberDto;
import dev.pina.backend.api.dto.UpdateSpaceRequest;
import dev.pina.backend.api.error.ApiErrors;
import dev.pina.backend.domain.SpaceRole;
import dev.pina.backend.domain.VariantType;
import dev.pina.backend.pagination.PageRequest;
import dev.pina.backend.service.AlbumService;
import dev.pina.backend.service.InviteLinkService;
import dev.pina.backend.service.MimeTypes;
import dev.pina.backend.service.PhotoService;
import dev.pina.backend.service.SpaceService;
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
import jakarta.ws.rs.core.StreamingOutput;
import java.io.InputStream;
import java.util.Optional;
import java.util.UUID;

@Path("/api/v1/spaces")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SpaceResource {

	@Inject
	SpaceService spaceService;

	@Inject
	AlbumService albumService;

	@Inject
	InviteLinkService inviteLinkService;

	@Inject
	PhotoService photoService;

	@Inject
	UserResolver userResolver;

	// ── Space CRUD ────────────────────────────────────────────────────────

	@POST
	public Response create(@Valid CreateSpaceRequest request) {
		var user = userResolver.currentUser();
		var space = spaceService.create(request.name(), request.description(), request.visibility(), user);
		return Response.status(Response.Status.CREATED).entity(SpaceDto.from(space)).build();
	}

	@GET
	public Response list() {
		var user = userResolver.currentUser();
		var spaces = spaceService.listByUser(user.id).stream().map(SpaceDto::from).toList();
		return Response.ok(spaces).build();
	}

	@GET
	@Path("/{id}")
	public Response getById(@PathParam("id") UUID id) {
		var user = userResolver.currentUser();
		return requireMember(id, user.id).flatMap(role -> spaceService.findById(id))
				.map(space -> Response.ok(SpaceDto.from(space)).build()).orElse(ApiErrors.notFound("Space not found"));
	}

	@PUT
	@Path("/{id}")
	public Response update(@PathParam("id") UUID id, @Valid UpdateSpaceRequest request) {
		var user = userResolver.currentUser();
		return requireRole(id, user.id, SpaceRole.ADMIN)
				.map(role -> spaceService
						.update(id, request.name(), request.description(), request.visibility(),
								request.inheritMembers())
						.map(space -> Response.ok(SpaceDto.from(space)).build())
						.orElse(ApiErrors.notFound("Space not found")))
				.orElse(ApiErrors.notFound("Space not found"));
	}

	@DELETE
	@Path("/{id}")
	public Response delete(@PathParam("id") UUID id) {
		var user = userResolver.currentUser();
		return requireRole(id, user.id, SpaceRole.OWNER).map(role -> {
			spaceService.delete(id);
			return Response.noContent().build();
		}).orElse(ApiErrors.notFound("Space not found"));
	}

	// ── Members ───────────────────────────────────────────────────────────

	@GET
	@Path("/{id}/members")
	public Response listMembers(@PathParam("id") UUID id) {
		var user = userResolver.currentUser();
		return requireMember(id, user.id).map(role -> {
			var members = spaceService.listMembers(id).stream().map(SpaceMemberDto::from).toList();
			return Response.ok(members).build();
		}).orElse(ApiErrors.notFound("Space not found"));
	}

	@POST
	@Path("/{id}/members")
	public Response addMember(@PathParam("id") UUID id, @Valid AddMemberRequest request) {
		var user = userResolver.currentUser();
		return requireRole(id, user.id, SpaceRole.ADMIN).map(role -> {
			try {
				return switch (spaceService.addMember(id, request.userId(), request.role())) {
					case CREATED -> Response.status(Response.Status.CREATED).build();
					case ALREADY_EXISTS -> Response.ok().build();
					case USER_NOT_FOUND -> ApiErrors.notFound("User not found");
				};
			} catch (IllegalArgumentException e) {
				return ApiErrors.badRequest(e.getMessage());
			}
		}).orElse(ApiErrors.notFound("Space not found"));
	}

	@PUT
	@Path("/{id}/members/{userId}")
	public Response changeRole(@PathParam("id") UUID id, @PathParam("userId") UUID userId,
			@Valid ChangeRoleRequest request) {
		var user = userResolver.currentUser();
		return requireRole(id, user.id, SpaceRole.ADMIN).map(role -> {
			try {
				return spaceService.changeRole(id, user.id, userId, request.role())
						.map(m -> Response.ok(SpaceMemberDto.from(m)).build())
						.orElse(ApiErrors.notFound("Space not found"));
			} catch (IllegalArgumentException e) {
				return ApiErrors.badRequest(e.getMessage());
			}
		}).orElse(ApiErrors.notFound("Space not found"));
	}

	@DELETE
	@Path("/{id}/members/{userId}")
	public Response removeMember(@PathParam("id") UUID id, @PathParam("userId") UUID userId) {
		var user = userResolver.currentUser();
		return requireMember(id, user.id).map(role -> {
			try {
				return switch (spaceService.removeMember(id, user.id, userId)) {
					case REMOVED -> Response.noContent().build();
					case NOT_FOUND -> ApiErrors.notFound("Space not found");
					case IS_OWNER -> ApiErrors.badRequest("Owner cannot be removed");
					case FORBIDDEN -> ApiErrors.notFound("Space not found");
				};
			} catch (IllegalArgumentException e) {
				return ApiErrors.badRequest(e.getMessage());
			}
		}).orElse(ApiErrors.notFound("Space not found"));
	}

	// ── Subspaces ─────────────────────────────────────────────────────────

	@GET
	@Path("/{id}/subspaces")
	public Response listSubspaces(@PathParam("id") UUID id) {
		var user = userResolver.currentUser();
		return requireMember(id, user.id).map(role -> {
			var accessibleSpaceIds = spaceService.listAccessibleSpaceIds(user.id);
			var subspaces = spaceService.listSubspaces(id).stream().filter(sub -> accessibleSpaceIds.contains(sub.id))
					.map(SpaceDto::from).toList();
			return Response.ok(subspaces).build();
		}).orElse(ApiErrors.notFound("Space not found"));
	}

	@POST
	@Path("/{id}/subspaces")
	public Response createSubspace(@PathParam("id") UUID id, @Valid CreateSpaceRequest request) {
		var user = userResolver.currentUser();
		return requireRole(id, user.id, SpaceRole.ADMIN).map(role -> {
			try {
				var subspace = spaceService.createSubspace(id, request.name(), request.description(),
						request.visibility(), user);
				return Response.status(Response.Status.CREATED).entity(SpaceDto.from(subspace)).build();
			} catch (IllegalArgumentException e) {
				return ApiErrors.badRequest(e.getMessage());
			}
		}).orElse(ApiErrors.notFound("Space not found"));
	}

	// ── Space Albums ─────────────────────────────────────────────────────

	@POST
	@Path("/{id}/albums")
	public Response createAlbum(@PathParam("id") UUID id, @Valid CreateAlbumRequest request) {
		var user = userResolver.currentUser();
		return requireRole(id, user.id, SpaceRole.MEMBER).flatMap(role -> spaceService.findById(id)).map(space -> {
			var album = albumService.createSpaceAlbum(request.name(), request.description(), space, user);
			return Response.status(Response.Status.CREATED).entity(AlbumDto.from(album)).build();
		}).orElse(ApiErrors.notFound("Space not found"));
	}

	@GET
	@Path("/{id}/albums")
	public Response listAlbums(@PathParam("id") UUID id) {
		var user = userResolver.currentUser();
		return requireRole(id, user.id, SpaceRole.VIEWER).map(role -> {
			var albums = albumService.listBySpace(id).stream().map(AlbumDto::from).toList();
			return Response.ok(albums).build();
		}).orElse(ApiErrors.notFound("Space not found"));
	}

	@PUT
	@Path("/{id}/albums/{albumId}")
	public Response updateAlbum(@PathParam("id") UUID id, @PathParam("albumId") UUID albumId,
			@Valid CreateAlbumRequest request) {
		var user = userResolver.currentUser();
		return requireRole(id, user.id, SpaceRole.MEMBER)
				.map(role -> albumService.findById(albumId).filter(a -> a.space != null && a.space.id.equals(id))
						.filter(a -> a.owner.id.equals(user.id) || role.isAtLeast(SpaceRole.ADMIN))
						.flatMap(a -> albumService.update(albumId, request.name(), request.description()))
						.map(updated -> Response.ok(AlbumDto.from(updated)).build())
						.orElse(ApiErrors.notFound("Album not found")))
				.orElse(ApiErrors.notFound("Space not found"));
	}

	@DELETE
	@Path("/{id}/albums/{albumId}")
	@Consumes(MediaType.WILDCARD)
	public Response deleteAlbum(@PathParam("id") UUID id, @PathParam("albumId") UUID albumId) {
		var user = userResolver.currentUser();
		return requireRole(id, user.id, SpaceRole.MEMBER)
				.map(role -> albumService.findById(albumId).filter(a -> a.space != null && a.space.id.equals(id))
						.filter(a -> a.owner.id.equals(user.id) || role.isAtLeast(SpaceRole.ADMIN)).map(a -> {
							albumService.delete(albumId);
							return Response.noContent().build();
						}).orElse(ApiErrors.notFound("Album not found")))
				.orElse(ApiErrors.notFound("Space not found"));
	}

	@POST
	@Path("/{id}/albums/{albumId}/photos/{photoId}")
	@Consumes(MediaType.WILDCARD)
	public Response addPhotoToAlbum(@PathParam("id") UUID id, @PathParam("albumId") UUID albumId,
			@PathParam("photoId") UUID photoId) {
		var user = userResolver.currentUser();
		return requireRole(id, user.id, SpaceRole.MEMBER).map(role -> {
			var album = albumService.findById(albumId);
			if (album.isEmpty() || album.get().space == null || !album.get().space.id.equals(id)) {
				return ApiErrors.notFound("Album not found");
			}
			return switch (albumService.addPhoto(albumId, photoId, user)) {
				case CREATED -> Response.status(Response.Status.CREATED).build();
				case ALREADY_EXISTS -> Response.ok().build();
				case NOT_FOUND, PHOTO_NOT_ACCESSIBLE -> ApiErrors.notFound("Album or photo not found");
			};
		}).orElse(ApiErrors.notFound("Space not found"));
	}

	@DELETE
	@Path("/{id}/albums/{albumId}/photos/{photoId}")
	@Consumes(MediaType.WILDCARD)
	public Response removePhotoFromAlbum(@PathParam("id") UUID id, @PathParam("albumId") UUID albumId,
			@PathParam("photoId") UUID photoId) {
		var user = userResolver.currentUser();
		return requireRole(id, user.id, SpaceRole.MEMBER).map(role -> {
			var album = albumService.findById(albumId);
			if (album.isEmpty() || album.get().space == null || !album.get().space.id.equals(id)) {
				return ApiErrors.notFound("Album not found");
			}
			boolean canManageAlbum = album.get().owner.id.equals(user.id) || role.isAtLeast(SpaceRole.ADMIN);
			return switch (albumService.removePhoto(albumId, photoId, user, canManageAlbum)) {
				case REMOVED -> Response.noContent().build();
				case NOT_FOUND, FORBIDDEN -> ApiErrors.notFound("Photo not found in album");
			};
		}).orElse(ApiErrors.notFound("Space not found"));
	}

	@GET
	@Path("/{id}/albums/{albumId}/photos")
	public Response listAlbumPhotos(@PathParam("id") UUID id, @PathParam("albumId") UUID albumId,
			@QueryParam("page") @DefaultValue("0") @Min(0) int page,
			@QueryParam("size") @DefaultValue("50") @Positive int size,
			@QueryParam("needsTotal") @DefaultValue("false") boolean needsTotal) {
		var user = userResolver.currentUser();
		return requireRole(id, user.id, SpaceRole.VIEWER).map(
				role -> albumService.findById(albumId).filter(a -> a.space != null && a.space.id.equals(id)).map(a -> {
					var photos = albumService.listPhotos(albumId, new PageRequest(page, size, needsTotal));
					return Response.ok(PageResponse.from(photos, PhotoDto::from)).build();
				}).orElse(ApiErrors.notFound("Album not found"))).orElse(ApiErrors.notFound("Space not found"));
	}

	@GET
	@Path("/{id}/albums/{albumId}/photos/{photoId}/file")
	@Produces(MediaType.APPLICATION_OCTET_STREAM)
	public Response getAlbumPhotoFile(@PathParam("id") UUID id, @PathParam("albumId") UUID albumId,
			@PathParam("photoId") UUID photoId, @QueryParam("variant") @DefaultValue("COMPRESSED") String variant) {
		VariantType type = parseVariant(variant);
		var user = userResolver.currentUser();
		return requireRole(id, user.id, SpaceRole.VIEWER).map(role -> {
			var album = albumService.findById(albumId);
			if (album.isEmpty() || album.get().space == null || !album.get().space.id.equals(id)) {
				return ApiErrors.notFound("Album not found");
			}
			return albumService.findPhotoInAlbum(albumId, photoId).map(photo -> {
				var found = photo.variants.stream().filter(v -> v.variantType == type).findFirst();
				if (found.isEmpty()) {
					return ApiErrors.notFound("Variant not available: " + type);
				}
				String contentType = MimeTypes.mimeForFormat(found.get().format);
				StreamingOutput output = os -> {
					try (InputStream stream = photoService.getVariantFile(photo, type)) {
						stream.transferTo(os);
					}
				};
				return Response.ok(output).type(contentType).build();
			}).orElse(ApiErrors.notFound("Photo not found in album"));
		}).orElse(ApiErrors.notFound("Space not found"));
	}

	// ── Invite Links ─────────────────────────────────────────────────────

	@POST
	@Path("/{id}/invites")
	public Response createInvite(@PathParam("id") UUID id, @Valid CreateInviteLinkRequest request) {
		var user = userResolver.currentUser();
		return requireRole(id, user.id, SpaceRole.ADMIN).map(role -> {
			try {
				var link = inviteLinkService.create(id, request.defaultRole(), request.expiration(),
						request.usageLimit(), user);
				return Response.status(Response.Status.CREATED).entity(InviteLinkDto.from(link)).build();
			} catch (IllegalArgumentException e) {
				return ApiErrors.badRequest(e.getMessage());
			}
		}).orElse(ApiErrors.notFound("Space not found"));
	}

	@GET
	@Path("/{id}/invites")
	public Response listInvites(@PathParam("id") UUID id) {
		var user = userResolver.currentUser();
		return requireRole(id, user.id, SpaceRole.ADMIN).map(role -> {
			var invites = inviteLinkService.listBySpace(id).stream().map(InviteLinkDto::from).toList();
			return Response.ok(invites).build();
		}).orElse(ApiErrors.notFound("Space not found"));
	}

	@DELETE
	@Path("/{id}/invites/{inviteId}")
	@Consumes(MediaType.WILDCARD)
	public Response revokeInvite(@PathParam("id") UUID id, @PathParam("inviteId") UUID inviteId) {
		var user = userResolver.currentUser();
		return requireRole(id, user.id, SpaceRole.ADMIN).map(role -> {
			if (inviteLinkService.revoke(inviteId, id)) {
				return Response.noContent().build();
			}
			return ApiErrors.notFound("Invite not found");
		}).orElse(ApiErrors.notFound("Space not found"));
	}

	// ── Helpers ───────────────────────────────────────────────────────────

	private Optional<SpaceRole> requireMember(UUID spaceId, UUID userId) {
		return spaceService.getEffectiveRole(spaceId, userId);
	}

	private Optional<SpaceRole> requireRole(UUID spaceId, UUID userId, SpaceRole minimumRole) {
		return spaceService.getEffectiveRole(spaceId, userId).filter(role -> role.isAtLeast(minimumRole));
	}

	private VariantType parseVariant(String variant) {
		try {
			return VariantType.valueOf(variant.toUpperCase());
		} catch (IllegalArgumentException _) {
			throw new IllegalArgumentException("Invalid variant: " + variant);
		}
	}
}
