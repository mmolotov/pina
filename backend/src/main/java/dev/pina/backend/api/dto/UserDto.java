package dev.pina.backend.api.dto;

import dev.pina.backend.domain.User;
import java.util.UUID;

public record UserDto(UUID id, String name, String email, String avatarUrl) {

	public static UserDto from(User u) {
		return new UserDto(u.id, u.name, u.email, u.avatarUrl);
	}
}
