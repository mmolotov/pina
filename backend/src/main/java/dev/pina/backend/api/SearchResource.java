package dev.pina.backend.api;

import dev.pina.backend.api.dto.PageResponse;
import dev.pina.backend.api.dto.SearchHitDto;
import dev.pina.backend.api.error.ApiErrors;
import dev.pina.backend.pagination.PageRequest;
import dev.pina.backend.service.SearchService;
import dev.pina.backend.service.UserResolver;
import jakarta.inject.Inject;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/search")
@Produces(MediaType.APPLICATION_JSON)
public class SearchResource {

	@Inject
	SearchService searchService;

	@Inject
	UserResolver userResolver;

	@GET
	public Response search(@QueryParam("q") @Size(max = 200) String query, @QueryParam("scope") String scope,
			@QueryParam("kind") String kind, @QueryParam("sort") String sort,
			@QueryParam("page") @DefaultValue("0") @Min(0) int page,
			@QueryParam("size") @DefaultValue("50") @Positive int size,
			@QueryParam("needsTotal") @DefaultValue("false") boolean needsTotal) {
		try {
			var request = new SearchService.SearchRequest(query, SearchService.SearchScope.parse(scope),
					SearchService.SearchKind.parse(kind), SearchService.SearchSort.parse(sort),
					new PageRequest(page, size, needsTotal));
			var user = userResolver.currentUser();
			var result = searchService.search(user, request);
			return Response.ok(PageResponse.from(result, SearchHitDto::from)).build();
		} catch (IllegalArgumentException e) {
			return ApiErrors.badRequest(e.getMessage());
		}
	}
}
