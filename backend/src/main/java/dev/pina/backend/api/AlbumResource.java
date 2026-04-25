package dev.pina.backend.api;

import dev.pina.backend.api.dto.AlbumDownloadUrlDto;
import dev.pina.backend.api.dto.AlbumDto;
import dev.pina.backend.api.dto.AlbumShareLinkCreatedDto;
import dev.pina.backend.api.dto.AlbumShareLinkDto;
import dev.pina.backend.api.dto.CreateAlbumRequest;
import dev.pina.backend.api.dto.CreateAlbumShareLinkRequest;
import dev.pina.backend.api.dto.PageResponse;
import dev.pina.backend.api.dto.PhotoDto;
import dev.pina.backend.api.dto.SetAlbumCoverRequest;
import dev.pina.backend.api.error.ApiErrors;
import dev.pina.backend.domain.VariantType;
import dev.pina.backend.pagination.PageRequest;
import dev.pina.backend.pagination.PageResult;
import dev.pina.backend.service.AlbumArchiveDownloadTokenService;
import dev.pina.backend.service.AlbumService;
import dev.pina.backend.service.AlbumShareLinkService;
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
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.Locale;
import java.util.UUID;

@Path("/api/v1/albums")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AlbumResource {

	@Inject
	AlbumService albumService;

	@Inject
	AlbumShareLinkService shareLinkService;

	@Inject
	AlbumArchiveDownloadTokenService albumArchiveDownloadTokenService;

	@Inject
	UserResolver userResolver;

	@POST
	public Response create(@Valid CreateAlbumRequest request) {
		var user = userResolver.currentUser();
		var album = albumService.create(request.name(), request.description(), user);
		return Response.status(Response.Status.CREATED).entity(AlbumDto.fromSummary(albumService.getSummary(album)))
				.build();
	}

	@GET
	public Response list(@QueryParam("page") @DefaultValue("0") @Min(0) int page,
			@QueryParam("size") @DefaultValue("50") @Positive int size,
			@QueryParam("needsTotal") @DefaultValue("false") boolean needsTotal, @QueryParam("sort") String sort,
			@QueryParam("direction") String direction) {
		AlbumService.SortField sortField;
		AlbumService.SortDirection sortDirection;
		try {
			sortField = AlbumService.SortField.parse(sort);
			sortDirection = AlbumService.SortDirection.parse(direction, sortField.defaultDirection());
		} catch (IllegalArgumentException e) {
			return ApiErrors.badRequest(e.getMessage());
		}
		var user = userResolver.currentUser();
		var albums = albumService.listByOwner(user.id, new PageRequest(page, size, needsTotal), sortField,
				sortDirection);
		var summaries = albumService.buildSummaries(albums.items());
		var summaryPage = new PageResult<>(summaries, albums.page(), albums.size(), albums.hasNext(),
				albums.totalItems(), albums.totalPages());
		return Response.ok(PageResponse.from(summaryPage, AlbumDto::fromSummary)).build();
	}

	@GET
	@Path("/{id}")
	public Response get(@PathParam("id") UUID id) {
		var user = userResolver.currentUser();
		return albumService.findById(id).filter(album -> album.owner.id.equals(user.id))
				.map(album -> Response.ok(AlbumDto.fromSummary(albumService.getSummary(album))).build())
				.orElse(ApiErrors.notFound("Album not found"));
	}

	@GET
	@Path("/{id}/photos")
	public Response listPhotos(@PathParam("id") UUID id, @QueryParam("page") @DefaultValue("0") @Min(0) int page,
			@QueryParam("size") @DefaultValue("50") @Positive int size,
			@QueryParam("needsTotal") @DefaultValue("false") boolean needsTotal) {
		var user = userResolver.currentUser();
		return albumService.findById(id).filter(album -> album.owner.id.equals(user.id)).map(album -> {
			var photos = albumService.listPhotos(id, new PageRequest(page, size, needsTotal));
			return Response.ok(PageResponse.from(photos, PhotoDto::from)).build();
		}).orElse(ApiErrors.notFound("Album not found"));
	}

	@PUT
	@Path("/{id}")
	public Response update(@PathParam("id") UUID id, @Valid CreateAlbumRequest request) {
		var user = userResolver.currentUser();
		return albumService.findById(id).filter(album -> album.owner.id.equals(user.id))
				.flatMap(album -> albumService.update(id, request.name(), request.description()))
				.map(updated -> Response.ok(AlbumDto.fromSummary(albumService.getSummary(updated))).build())
				.orElse(ApiErrors.notFound("Album not found"));
	}

	@POST
	@Path("/{id}/photos/{photoId}")
	@Consumes(MediaType.WILDCARD)
	public Response addPhoto(@PathParam("id") UUID id, @PathParam("photoId") UUID photoId) {
		var user = userResolver.currentUser();
		var album = albumService.findById(id);
		if (album.isEmpty() || !album.get().owner.id.equals(user.id)) {
			return ApiErrors.notFound("Album not found");
		}
		return switch (albumService.addPhoto(id, photoId, user)) {
			case CREATED -> Response.status(Response.Status.CREATED).build();
			case ALREADY_EXISTS -> Response.ok().build();
			case NOT_FOUND, PHOTO_NOT_ACCESSIBLE -> ApiErrors.notFound("Album or photo not found");
		};
	}

	@DELETE
	@Path("/{id}/photos/{photoId}")
	@Consumes(MediaType.WILDCARD)
	public Response removePhoto(@PathParam("id") UUID id, @PathParam("photoId") UUID photoId) {
		var user = userResolver.currentUser();
		var album = albumService.findById(id);
		if (album.isEmpty() || !album.get().owner.id.equals(user.id)) {
			return ApiErrors.notFound("Album not found");
		}
		return switch (albumService.removePhoto(id, photoId, user, true)) {
			case REMOVED -> Response.noContent().build();
			case NOT_FOUND -> ApiErrors.notFound("Album photo reference not found");
			case FORBIDDEN -> ApiErrors.notFound("Album photo reference not found");
		};
	}

	@DELETE
	@Path("/{id}")
	public Response delete(@PathParam("id") UUID id) {
		var user = userResolver.currentUser();
		var album = albumService.findById(id);
		if (album.isEmpty() || !album.get().owner.id.equals(user.id)) {
			return ApiErrors.notFound("Album not found");
		}
		albumService.delete(id);
		return Response.noContent().build();
	}

	@PUT
	@Path("/{id}/cover")
	public Response setCover(@PathParam("id") UUID id, @Valid SetAlbumCoverRequest request) {
		var user = userResolver.currentUser();
		var album = albumService.findById(id);
		if (album.isEmpty() || !album.get().owner.id.equals(user.id)) {
			return ApiErrors.notFound("Album not found");
		}
		return switch (albumService.setCoverPhoto(id, request.photoId())) {
			case AlbumService.SetCoverResult.Set set ->
				Response.ok(AlbumDto.fromSummary(albumService.getSummary(set.album()))).build();
			case AlbumService.SetCoverResult.AlbumNotFound _ -> ApiErrors.notFound("Album not found");
			case AlbumService.SetCoverResult.PhotoNotInAlbum _ -> ApiErrors.notFound("Photo not found in album");
		};
	}

	@GET
	@Path("/{id}/download")
	@Produces("application/zip")
	public Response download(@PathParam("id") UUID id, @QueryParam("variant") String variant) {
		VariantType variantType;
		try {
			variantType = parseDownloadVariant(variant);
		} catch (IllegalArgumentException e) {
			return ApiErrors.badRequest(e.getMessage());
		}
		var user = userResolver.currentUser();
		var album = albumService.findById(id);
		if (album.isEmpty() || !album.get().owner.id.equals(user.id)) {
			return ApiErrors.notFound("Album not found");
		}
		return buildArchiveDownloadResponse(album.get().name, id, variantType);
	}

	@POST
	@Path("/{id}/download-url")
	@Consumes(MediaType.WILDCARD)
	public Response createDownloadUrl(@PathParam("id") UUID id, @QueryParam("variant") String variant) {
		VariantType variantType;
		try {
			variantType = parseDownloadVariant(variant);
		} catch (IllegalArgumentException e) {
			return ApiErrors.badRequest(e.getMessage());
		}
		var user = userResolver.currentUser();
		var album = albumService.findById(id);
		if (album.isEmpty() || !album.get().owner.id.equals(user.id)) {
			return ApiErrors.notFound("Album not found");
		}
		var minted = albumArchiveDownloadTokenService.mint(id, user.id, variantType);
		String url = "/api/v1/albums/" + id + "/download-by-token?token="
				+ URLEncoder.encode(minted.token(), StandardCharsets.UTF_8);
		return Response.ok(new AlbumDownloadUrlDto(url, minted.expiresAt())).build();
	}

	@GET
	@Path("/{id}/download-by-token")
	@Produces("application/zip")
	public Response downloadByToken(@PathParam("id") UUID id, @QueryParam("token") String token) {
		var claims = albumArchiveDownloadTokenService.validate(id, token);
		if (claims.isEmpty()) {
			return ApiErrors.notFound("Album not found");
		}
		var album = albumService.findById(id);
		if (album.isEmpty() || !album.get().owner.id.equals(claims.get().ownerId())) {
			return ApiErrors.notFound("Album not found");
		}
		return buildArchiveDownloadResponse(album.get().name, id, claims.get().variantType());
	}

	private static VariantType parseDownloadVariant(String raw) {
		if (raw == null || raw.isBlank()) {
			return VariantType.ORIGINAL;
		}
		return switch (raw.strip().toUpperCase(Locale.ROOT)) {
			case "ORIGINAL" -> VariantType.ORIGINAL;
			case "COMPRESSED" -> VariantType.COMPRESSED;
			default -> throw new IllegalArgumentException("Invalid variant: " + raw);
		};
	}

	private static String asciiDownloadFilename(String name) {
		if (name == null) {
			return "album.zip";
		}
		String slug = Normalizer.normalize(name, Normalizer.Form.NFKD).replaceAll("\\p{M}+", "")
				.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
		return (slug.isEmpty() ? "album" : slug) + ".zip";
	}

	private static String unicodeDownloadFilename(String name) {
		if (name == null || name.isBlank()) {
			return "album.zip";
		}
		String sanitized = name.strip().replace('\\', '_').replace('/', '_').replaceAll("\\p{Cntrl}", "_");
		return sanitized.isBlank() ? "album.zip" : sanitized + ".zip";
	}

	private static String contentDispositionAttachment(String asciiFilename, String utf8Filename) {
		String encoded = URLEncoder.encode(utf8Filename, StandardCharsets.UTF_8).replace("+", "%20");
		return "attachment; filename=\"" + asciiFilename + "\"; filename*=UTF-8''" + encoded;
	}

	private Response buildArchiveDownloadResponse(String albumName, UUID albumId, VariantType variantType) {
		var entries = albumService.collectArchiveEntries(albumId, variantType);
		var output = albumService.streamAlbumArchive(entries);
		String filename = asciiDownloadFilename(albumName);
		return noStore(Response.ok(output).type("application/zip").header("Content-Disposition",
				contentDispositionAttachment(filename, unicodeDownloadFilename(albumName)))).build();
	}

	private static Response.ResponseBuilder noStore(Response.ResponseBuilder builder) {
		return builder.header("Cache-Control", "no-store").header("Pragma", "no-cache").header("Expires", "0");
	}

	@DELETE
	@Path("/{id}/cover")
	@Consumes(MediaType.WILDCARD)
	public Response clearCover(@PathParam("id") UUID id) {
		var user = userResolver.currentUser();
		var album = albumService.findById(id);
		if (album.isEmpty() || !album.get().owner.id.equals(user.id)) {
			return ApiErrors.notFound("Album not found");
		}
		return albumService.clearCoverPhoto(id)
				.map(updated -> Response.ok(AlbumDto.fromSummary(albumService.getSummary(updated))).build())
				.orElse(ApiErrors.notFound("Album not found"));
	}

	@POST
	@Path("/{id}/share-links")
	public Response createShareLink(@PathParam("id") UUID id, CreateAlbumShareLinkRequest request) {
		var user = userResolver.currentUser();
		var album = albumService.findById(id);
		if (album.isEmpty() || !album.get().owner.id.equals(user.id)) {
			return ApiErrors.notFound("Album not found");
		}
		var expiresAt = request == null ? null : request.expiresAt();
		var created = shareLinkService.create(id, expiresAt, user);
		return Response.status(Response.Status.CREATED)
				.entity(AlbumShareLinkCreatedDto.of(created.link(), created.token())).build();
	}

	@GET
	@Path("/{id}/share-links")
	public Response listShareLinks(@PathParam("id") UUID id) {
		var user = userResolver.currentUser();
		var album = albumService.findById(id);
		if (album.isEmpty() || !album.get().owner.id.equals(user.id)) {
			return ApiErrors.notFound("Album not found");
		}
		var links = shareLinkService.listByAlbum(id).stream().map(AlbumShareLinkDto::from).toList();
		return Response.ok(links).build();
	}

	@DELETE
	@Path("/{id}/share-links/{linkId}")
	@Consumes(MediaType.WILDCARD)
	public Response revokeShareLink(@PathParam("id") UUID id, @PathParam("linkId") UUID linkId) {
		var user = userResolver.currentUser();
		var album = albumService.findById(id);
		if (album.isEmpty() || !album.get().owner.id.equals(user.id)) {
			return ApiErrors.notFound("Album not found");
		}
		if (!shareLinkService.revoke(id, linkId)) {
			return ApiErrors.notFound("Share link not found");
		}
		return Response.noContent().build();
	}
}
