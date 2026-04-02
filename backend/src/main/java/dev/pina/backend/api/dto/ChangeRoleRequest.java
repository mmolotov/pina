package dev.pina.backend.api.dto;

import dev.pina.backend.domain.SpaceRole;
import jakarta.validation.constraints.NotNull;

public record ChangeRoleRequest(@NotNull SpaceRole role) {
}
