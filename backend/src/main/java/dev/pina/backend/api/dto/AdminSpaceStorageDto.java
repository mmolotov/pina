package dev.pina.backend.api.dto;

import java.util.UUID;

public record AdminSpaceStorageDto(UUID spaceId, String spaceName, long albumCount, long photoCount) {
}
