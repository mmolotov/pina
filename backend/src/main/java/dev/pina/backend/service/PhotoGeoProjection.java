package dev.pina.backend.service;

import java.time.OffsetDateTime;
import java.util.UUID;

public record PhotoGeoProjection(UUID id, UUID uploaderId, String originalFilename, String mimeType, Integer width,
		Integer height, long sizeBytes, UUID personalLibraryId, OffsetDateTime takenAt, Double latitude,
		Double longitude, OffsetDateTime createdAt) {
}
