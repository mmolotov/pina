package dev.pina.backend.api.dto;

import dev.pina.backend.domain.Favorite;
import dev.pina.backend.domain.FavoriteTargetType;
import java.time.OffsetDateTime;
import java.util.UUID;

public record FavoriteDto(UUID id, UUID userId, FavoriteTargetType targetType, UUID targetId,
		OffsetDateTime createdAt) {

	public static FavoriteDto from(Favorite f) {
		return new FavoriteDto(f.id, f.user.id, f.targetType, f.targetId, f.createdAt);
	}
}
