package dev.pina.backend.api.dto;

import dev.pina.backend.domain.InstanceRole;

public record AdminUpdateUserRequest(InstanceRole instanceRole, Boolean active) {
}
