package dev.pina.backend.api.dto;

import dev.pina.backend.domain.User;

public record AuthResponse(String accessToken, String refreshToken, long expiresIn, UserDto user) {

	public static AuthResponse of(String accessToken, String refreshToken, long expiresIn, User user) {
		return new AuthResponse(accessToken, refreshToken, expiresIn, UserDto.from(user));
	}
}
