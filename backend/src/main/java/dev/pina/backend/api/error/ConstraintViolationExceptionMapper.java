package dev.pina.backend.api.error;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

@Provider
public class ConstraintViolationExceptionMapper implements ExceptionMapper<ConstraintViolationException> {

	@Override
	public Response toResponse(ConstraintViolationException exception) {
		String message = exception.getConstraintViolations().stream().findFirst().map(ConstraintViolation::getMessage)
				.orElse("Validation failed");
		return Response.status(Response.Status.BAD_REQUEST).type(MediaType.APPLICATION_JSON_TYPE)
				.entity(new ApiError("bad_request", message)).build();
	}
}
