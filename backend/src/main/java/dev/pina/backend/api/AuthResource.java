package dev.pina.backend.api;

import dev.pina.backend.api.dto.AuthResponse;
import dev.pina.backend.api.dto.GoogleLoginRequest;
import dev.pina.backend.api.dto.LoginRequest;
import dev.pina.backend.api.dto.LogoutRequest;
import dev.pina.backend.api.dto.RefreshRequest;
import dev.pina.backend.api.dto.RegisterRequest;
import dev.pina.backend.api.dto.UpdateProfileRequest;
import dev.pina.backend.api.dto.UserDto;
import dev.pina.backend.api.error.ApiErrors;
import dev.pina.backend.service.AuthService;
import dev.pina.backend.service.EmailAlreadyExistsException;
import dev.pina.backend.service.GoogleTokenVerifier;
import dev.pina.backend.service.UserResolver;
import dev.pina.backend.service.UsernameAlreadyExistsException;
import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/auth")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AuthResource {

	@Inject
	AuthService authService;

	@Inject
	GoogleTokenVerifier googleTokenVerifier;

	@Inject
	UserResolver userResolver;

	@POST
	@Path("/register")
	@PermitAll
	public Response register(@Valid RegisterRequest request) {
		try {
			var user = authService.register(request.username(), request.password(), request.name());
			return Response.status(Response.Status.CREATED).entity(buildAuthResponse(user)).build();
		} catch (UsernameAlreadyExistsException e) {
			return ApiErrors.conflict(e.getMessage());
		}
	}

	@POST
	@Path("/login")
	@PermitAll
	public Response login(@Valid LoginRequest request) {
		return authService.authenticate(request.username(), request.password())
				.map(user -> Response.ok(buildAuthResponse(user)).build())
				.orElse(ApiErrors.unauthorized("Invalid username or password"));
	}

	@POST
	@Path("/google")
	@PermitAll
	public Response googleLogin(@Valid GoogleLoginRequest request) {
		return googleTokenVerifier.verify(request.idToken()).map(googleToken -> {
			try {
				var user = authService.loginWithGoogle(googleToken);
				return Response.ok(buildAuthResponse(user)).build();
			} catch (EmailAlreadyExistsException e) {
				return ApiErrors.conflict(e.getMessage());
			}
		}).orElse(ApiErrors.unauthorized("Invalid Google ID token"));
	}

	@POST
	@Path("/refresh")
	@PermitAll
	public Response refresh(@Valid RefreshRequest request) {
		return authService.refresh(request.refreshToken()).map(pair -> {
			var response = AuthResponse.of(pair.accessToken(), pair.refreshToken(),
					authService.getAccessTokenLifespan(), pair.user());
			return Response.ok(response).build();
		}).orElse(ApiErrors.unauthorized("Invalid or expired refresh token"));
	}

	@POST
	@Path("/logout")
	@PermitAll
	public Response logout(@Valid LogoutRequest request) {
		authService.logout(request.refreshToken());
		return Response.noContent().build();
	}

	@POST
	@Path("/link/google")
	public Response linkGoogle(@Valid GoogleLoginRequest request) {
		return googleTokenVerifier.verify(request.idToken()).map(googleToken -> {
			var user = userResolver.currentUser();
			try {
				authService.linkGoogleAccount(user, googleToken);
				return Response.ok().build();
			} catch (IllegalArgumentException e) {
				return ApiErrors.conflict(e.getMessage());
			}
		}).orElse(ApiErrors.unauthorized("Invalid Google ID token"));
	}

	@GET
	@Path("/me")
	public Response me() {
		var user = userResolver.currentUser();
		return Response.ok(UserDto.from(user)).build();
	}

	@PUT
	@Path("/me")
	public Response updateProfile(@Valid UpdateProfileRequest request) {
		try {
			var user = userResolver.updateProfile(request);
			return Response.ok(UserDto.from(user)).build();
		} catch (EmailAlreadyExistsException e) {
			return ApiErrors.conflict(e.getMessage());
		}
	}

	private AuthResponse buildAuthResponse(dev.pina.backend.domain.User user) {
		var accessToken = authService.generateAccessToken(user);
		var refreshToken = authService.createRefreshToken(user);
		return AuthResponse.of(accessToken, refreshToken, authService.getAccessTokenLifespan(), user);
	}
}
