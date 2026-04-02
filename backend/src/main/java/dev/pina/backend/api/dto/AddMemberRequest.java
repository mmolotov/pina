package dev.pina.backend.api.dto;

import dev.pina.backend.domain.SpaceRole;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record AddMemberRequest(@NotNull UUID userId, SpaceRole role) {
}
