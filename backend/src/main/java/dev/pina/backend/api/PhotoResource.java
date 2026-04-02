package dev.pina.backend.api;

import dev.pina.backend.api.dto.PageResponse;
import dev.pina.backend.api.dto.PhotoDto;
import dev.pina.backend.api.error.ApiErrors;
import dev.pina.backend.domain.VariantType;
import dev.pina.backend.pagination.PageRequest;
import dev.pina.backend.service.MimeTypes;
import dev.pina.backend.service.PhotoService;
import dev.pina.backend.service.UserResolver;
import jakarta.inject.Inject;
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
import jakarta.ws.rs.core.StreamingOutput;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.util.UUID;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

@Path("/api/v1/photos")
@Produces(MediaType.APPLICATION_JSON)
public class PhotoResource {

	@Inject
	PhotoService photoService;

	@Inject
	UserResolver userResolver;

	@POST
	@Consumes(MediaType.MULTIPART_FORM_DATA)
	public Response upload(@RestForm("file") FileUpload file) throws IOException {
		if (!MimeTypes.isSupportedImage(file.contentType())) {
			return ApiErrors.unsupportedMediaType("Unsupported image type: " + file.contentType());
		}
		var user = userResolver.currentUser();
		try (InputStream is = Files.newInputStream(file.uploadedFile())) {
			var photo = photoService.upload(is, file.fileName(), file.contentType(), user);
			return Response.status(Response.Status.CREATED).entity(PhotoDto.from(photo)).build();
		}
	}

	@GET
	public Response list(@QueryParam("page") @DefaultValue("0") @Min(0) int page,
			@QueryParam("size") @DefaultValue("50") @Positive int size,
			@QueryParam("needsTotal") @DefaultValue("false") boolean needsTotal) {
		var user = userResolver.currentUser();
		var photos = photoService.listByUploader(user.id, new PageRequest(page, size, needsTotal));
		return Response.ok(PageResponse.from(photos, PhotoDto::from)).build();
	}

	@GET
	@Path("/{id}")
	public Response getById(@PathParam("id") UUID id) {
		var user = userResolver.currentUser();
		return photoService.findById(id).filter(p -> p.uploader.id.equals(user.id))
				.map(p -> Response.ok(PhotoDto.from(p)).build()).orElse(ApiErrors.notFound("Photo not found"));
	}

	@GET
	@Path("/{id}/file")
	@Produces(MediaType.APPLICATION_OCTET_STREAM)
	public Response getFile(@PathParam("id") UUID id,
			@QueryParam("variant") @DefaultValue("COMPRESSED") String variant) {
		VariantType type = parseVariant(variant);

		var user = userResolver.currentUser();
		return photoService.findById(id).filter(photo -> photo.uploader.id.equals(user.id)).map(photo -> {
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
		}).orElse(ApiErrors.notFound("Photo not found"));
	}

	@DELETE
	@Path("/{id}")
	public Response delete(@PathParam("id") UUID id) {
		var user = userResolver.currentUser();
		var photo = photoService.findById(id);
		if (photo.isEmpty() || !photo.get().uploader.id.equals(user.id)) {
			return ApiErrors.notFound("Photo not found");
		}
		return switch (photoService.delete(id)) {
			case DELETED -> Response.noContent().build();
			case HAS_REFERENCES -> ApiErrors.conflict("Photo still has album references");
			case NOT_FOUND -> ApiErrors.notFound("Photo not found");
		};
	}

	private VariantType parseVariant(String variant) {
		try {
			return VariantType.valueOf(variant.toUpperCase());
		} catch (IllegalArgumentException _) {
			throw new IllegalArgumentException("Invalid variant: " + variant);
		}
	}
}
