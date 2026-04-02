package dev.pina.backend.api.dto;

import dev.pina.backend.domain.FavoriteTargetType;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record CreateFavoriteRequest(@NotNull FavoriteTargetType targetType, @NotNull UUID targetId) {
}
