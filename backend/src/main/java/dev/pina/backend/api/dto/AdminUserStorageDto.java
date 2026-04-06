package dev.pina.backend.api.dto;

import java.util.UUID;

public record AdminUserStorageDto(UUID userId, String userName, long photoCount, long variantCount,
		long storageBytesUsed) {
}
