package dev.pina.backend.api;

import dev.pina.backend.api.dto.AlbumDto;
import dev.pina.backend.api.dto.PageResponse;
import dev.pina.backend.api.dto.PhotoDto;
import dev.pina.backend.api.error.ApiErrors;
import dev.pina.backend.domain.VariantType;
import dev.pina.backend.pagination.PageRequest;
import dev.pina.backend.service.AlbumService;
import dev.pina.backend.service.AlbumShareLinkService;
import dev.pina.backend.service.MimeTypes;
import dev.pina.backend.service.PhotoService;
import jakarta.inject.Inject;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.StreamingOutput;
import java.io.InputStream;
import java.util.UUID;

@Path("/api/v1/public/albums")
@Produces(MediaType.APPLICATION_JSON)
public class PublicAlbumResource {

	@Inject
	AlbumService albumService;

	@Inject
	AlbumShareLinkService shareLinkService;

	@Inject
	PhotoService photoService;

	@GET
	@Path("/by-token/{token}")
	public Response getByToken(@PathParam("token") String token,
			@QueryParam("page") @DefaultValue("0") @Min(0) int page,
			@QueryParam("size") @DefaultValue("50") @Positive int size,
			@QueryParam("needsTotal") @DefaultValue("false") boolean needsTotal) {
		var linkOpt = shareLinkService.findValidByToken(token);
		if (linkOpt.isEmpty()) {
			return ApiErrors.notFound("Share link not found");
		}
		var album = linkOpt.get().album;
		var summary = albumService.getSummary(album);
		var photos = albumService.listPhotos(album.id, new PageRequest(page, size, needsTotal));
		return Response
				.ok(new PublicAlbumResponse(AlbumDto.fromSummary(summary), PageResponse.from(photos, PhotoDto::from)))
				.build();
	}

	@GET
	@Path("/by-token/{token}/photos/{photoId}/file")
	@Produces(MediaType.APPLICATION_OCTET_STREAM)
	public Response getPhotoFile(@PathParam("token") String token, @PathParam("photoId") UUID photoId,
			@QueryParam("variant") @DefaultValue("COMPRESSED") String variant) {
		VariantType type;
		try {
			type = VariantType.valueOf(variant.toUpperCase());
		} catch (IllegalArgumentException _) {
			return ApiErrors.badRequest("Invalid variant: " + variant);
		}
		var linkOpt = shareLinkService.findValidByToken(token);
		if (linkOpt.isEmpty()) {
			return ApiErrors.notFound("Share link not found");
		}
		UUID albumId = linkOpt.get().album.id;
		var photo = photoService.findById(photoId).filter(p -> albumService.hasPhoto(linkOpt.get().album, p));
		if (photo.isEmpty()) {
			return ApiErrors.notFound("Photo not found");
		}
		var variantFile = photo.get().variants.stream().filter(v -> v.variantType == type).findFirst();
		if (variantFile.isEmpty()) {
			return ApiErrors.notFound("Variant not available: " + type);
		}
		String contentType = MimeTypes.mimeForFormat(variantFile.get().format);
		StreamingOutput output = os -> {
			try (InputStream stream = photoService.getVariantFile(photo.get(), type)) {
				stream.transferTo(os);
			}
		};
		return Response.ok(output).type(contentType).header("X-Album-Id", albumId.toString()).build();
	}

	public record PublicAlbumResponse(AlbumDto album, PageResponse<PhotoDto> photos) {
	}
}
