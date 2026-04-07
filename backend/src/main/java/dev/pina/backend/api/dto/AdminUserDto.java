package dev.pina.backend.api.dto;

import dev.pina.backend.domain.InstanceRole;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record AdminUserDto(UUID id, String name, String email, String avatarUrl, InstanceRole instanceRole,
		boolean active, OffsetDateTime createdAt, OffsetDateTime updatedAt, List<String> providers, long photoCount,
		long storageBytesUsed) {
}
