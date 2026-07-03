package dev.pina.backend.api;

import dev.pina.backend.api.dto.PageResponse;
import dev.pina.backend.api.error.ApiErrors;
import dev.pina.backend.domain.AnalysisJobStatus;
import dev.pina.backend.pagination.PageRequest;
import dev.pina.backend.service.AdminMlService;
import dev.pina.backend.service.UserResolver;
import jakarta.inject.Inject;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Path("/api/v1/admin/ml")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AdminMlResource {

	@Inject
	UserResolver userResolver;

	@Inject
	AdminMlService adminMlService;

	@GET
	public Response status() {
		userResolver.requireAdmin();
		return Response.ok(adminMlService.getMl()).build();
	}

	@GET
	@Path("/jobs")
	public Response jobs(@QueryParam("page") @DefaultValue("0") @Min(0) int page,
			@QueryParam("size") @DefaultValue("20") @Positive int size,
			@QueryParam("needsTotal") @DefaultValue("true") boolean needsTotal, @QueryParam("status") String status) {
		userResolver.requireAdmin();
		var result = adminMlService.listJobs(new PageRequest(page, size, needsTotal), parseStatus(status));
		return Response.ok(PageResponse.from(result, dto -> dto)).build();
	}

	@POST
	@Path("/jobs/{photoId}/retry")
	public Response retry(@PathParam("photoId") UUID photoId) {
		userResolver.requireAdmin();
		return adminMlService.retry(photoId)
				? Response.noContent().build()
				: ApiErrors.notFound("No failed analysis job for this photo");
	}

	@POST
	@Path("/jobs/{photoId}/reanalyze")
	public Response reanalyze(@PathParam("photoId") UUID photoId) {
		userResolver.requireAdmin();
		return adminMlService.reanalyze(photoId)
				? Response.noContent().build()
				: ApiErrors.notFound("No analysis job for this photo");
	}

	@POST
	@Path("/retry-failed")
	public Response retryFailed() {
		userResolver.requireAdmin();
		return Response.ok(Map.of("requeued", adminMlService.retryAllFailed())).build();
	}

	private static AnalysisJobStatus parseStatus(String value) {
		if (value == null || value.isBlank() || "ALL".equalsIgnoreCase(value)) {
			return null;
		}
		try {
			return AnalysisJobStatus.valueOf(value.toUpperCase(Locale.ROOT));
		} catch (IllegalArgumentException _) {
			return null;
		}
	}
}
