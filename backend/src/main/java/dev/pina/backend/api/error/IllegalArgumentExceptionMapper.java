package dev.pina.backend.api.error;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

@Provider
public class IllegalArgumentExceptionMapper implements ExceptionMapper<IllegalArgumentException> {

	@Override
	public Response toResponse(IllegalArgumentException exception) {
		return Response.status(Response.Status.BAD_REQUEST).type(MediaType.APPLICATION_JSON_TYPE)
				.entity(new ApiError("bad_request", exception.getMessage())).build();
	}
}
