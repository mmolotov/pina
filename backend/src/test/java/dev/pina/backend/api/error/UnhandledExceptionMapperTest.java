package dev.pina.backend.api.error;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.Test;

@QuarkusTest
class UnhandledExceptionMapperTest {

	@Test
	void preservesWebApplicationExceptionResponse() {
		UnhandledExceptionMapper mapper = new UnhandledExceptionMapper();
		Response original = Response.status(Response.Status.NOT_FOUND).entity("missing").build();

		Response mapped = mapper.toResponse(new WebApplicationException(original));

		assertSame(original, mapped);
	}

	@Test
	void mapsUnexpectedExceptionToInternalError() {
		UnhandledExceptionMapper mapper = new UnhandledExceptionMapper();

		Response response = mapper.toResponse(new RuntimeException("boom"));

		assertEquals(500, response.getStatus());
		assertEquals(new ApiError("internal_error", "Internal server error"), response.getEntity());
	}
}
