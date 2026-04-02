package dev.pina.backend.api.dto;

import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(@Size(max = 255) String name, @Size(max = 255) String email) {
}
