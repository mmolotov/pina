package dev.pina.backend.api.error;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

public final class ApiErrors {

	private ApiErrors() {
	}

	public static Response unsupportedMediaType(String message) {
		return response(Response.Status.UNSUPPORTED_MEDIA_TYPE, "unsupported_media_type", message);
	}

	public static Response notFound(String message) {
		return response(Response.Status.NOT_FOUND, "not_found", message);
	}

	public static Response forbidden(String message) {
		return response(Response.Status.FORBIDDEN, "forbidden", message);
	}

	public static Response unauthorized(String message) {
		return response(Response.Status.UNAUTHORIZED, "unauthorized", message);
	}

	public static Response badRequest(String message) {
		return response(Response.Status.BAD_REQUEST, "bad_request", message);
	}

	public static Response conflict(String message) {
		return response(Response.Status.CONFLICT, "conflict", message);
	}

	public static Response tooManyRequests(String message) {
		return response(Response.Status.TOO_MANY_REQUESTS, "too_many_requests", message);
	}

	private static Response response(Response.Status status, String error, String message) {
		return Response.status(status).type(MediaType.APPLICATION_JSON_TYPE).entity(new ApiError(error, message))
				.build();
	}
}
