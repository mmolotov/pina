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
	@Path("/geo")
	public Response geo(@QueryParam("swLat") Double swLat, @QueryParam("swLng") Double swLng,
			@QueryParam("neLat") Double neLat, @QueryParam("neLng") Double neLng,
			@QueryParam("page") @DefaultValue("0") @Min(0) int page,
			@QueryParam("size") @DefaultValue("50") @Positive int size,
			@QueryParam("needsTotal") @DefaultValue("false") boolean needsTotal) {
		if (swLat == null || swLng == null || neLat == null || neLng == null) {
			return ApiErrors.badRequest("swLat, swLng, neLat, neLng are required");
		}
		if (!isFinite(swLat) || !isFinite(swLng) || !isFinite(neLat) || !isFinite(neLng)) {
			return ApiErrors.badRequest("Geo coordinates must be finite numbers");
		}
		if (swLat < -90 || swLat > 90 || neLat < -90 || neLat > 90) {
			return ApiErrors.badRequest("Latitude must be between -90 and 90");
		}
		if (swLng < -180 || swLng > 180 || neLng < -180 || neLng > 180) {
			return ApiErrors.badRequest("Longitude must be between -180 and 180");
		}
		if (swLat > neLat) {
			return ApiErrors.badRequest("swLat must be less than or equal to neLat");
		}
		var user = userResolver.currentUser();
		var photos = photoService.findInBoundingBox(user.id, swLat, swLng, neLat, neLng,
				new PageRequest(page, size, needsTotal));
		return Response.ok(PageResponse.from(photos, PhotoDto::from)).build();
	}

	@GET
	@Path("/geo/nearby")
	public Response nearby(@QueryParam("lat") Double lat, @QueryParam("lng") Double lng,
			@QueryParam("radiusKm") @DefaultValue("10") double radiusKm,
			@QueryParam("page") @DefaultValue("0") @Min(0) int page,
			@QueryParam("size") @DefaultValue("50") @Positive int size,
			@QueryParam("needsTotal") @DefaultValue("false") boolean needsTotal) {
		if (lat == null || lng == null) {
			return ApiErrors.badRequest("lat and lng are required");
		}
		if (!isFinite(lat) || !isFinite(lng) || !Double.isFinite(radiusKm)) {
			return ApiErrors.badRequest("Geo coordinates and radiusKm must be finite numbers");
		}
		if (lat < -90 || lat > 90) {
			return ApiErrors.badRequest("Latitude must be between -90 and 90");
		}
		if (lng < -180 || lng > 180) {
			return ApiErrors.badRequest("Longitude must be between -180 and 180");
		}
		if (radiusKm <= 0 || radiusKm > 20000) {
			return ApiErrors.badRequest("radiusKm must be between 0 and 20000");
		}
		double deltaLat = radiusKm / 111.0;
		double cosine = Math.abs(Math.cos(Math.toRadians(lat)));
		double deltaLng = cosine < 1.0e-9 ? 180.0 : Math.min(180.0, radiusKm / (111.0 * cosine));
		double swLat = Math.max(-90.0, lat - deltaLat);
		double neLat = Math.min(90.0, lat + deltaLat);
		double swLng = deltaLng >= 180.0 ? -180.0 : normalizeLongitude(lng - deltaLng);
		double neLng = deltaLng >= 180.0 ? 180.0 : normalizeLongitude(lng + deltaLng);
		var user = userResolver.currentUser();
		var photos = photoService.findNearby(user.id, lat, lng, radiusKm, swLat, swLng, neLat, neLng,
				new PageRequest(page, size, needsTotal));
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

	private double normalizeLongitude(double longitude) {
		double normalized = ((longitude + 180.0) % 360.0 + 360.0) % 360.0 - 180.0;
		return normalized == -180.0 ? 180.0 : normalized;
	}

	private boolean isFinite(Double value) {
		return value != null && Double.isFinite(value);
	}
}
