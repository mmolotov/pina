package dev.pina.backend.api.error;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import org.jboss.logging.Logger;

@Provider
public class UnhandledExceptionMapper implements ExceptionMapper<Throwable> {

	private static final Logger LOG = Logger.getLogger(UnhandledExceptionMapper.class);

	@Override
	public Response toResponse(Throwable exception) {
		if (exception instanceof WebApplicationException webApplicationException) {
			return webApplicationException.getResponse();
		}

		LOG.error("Unhandled backend exception", exception);
		return Response.status(Response.Status.INTERNAL_SERVER_ERROR).type(MediaType.APPLICATION_JSON_TYPE)
				.entity(new ApiError("internal_error", "Internal server error")).build();
	}
}
