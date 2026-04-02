package dev.pina.backend.api.dto;

import dev.pina.backend.domain.SpaceVisibility;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateSpaceRequest(@NotBlank @Size(max = 255) String name, @Size(max = 2000) String description,
		SpaceVisibility visibility) {
}
