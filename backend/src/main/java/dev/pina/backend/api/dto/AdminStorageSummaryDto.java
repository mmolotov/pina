package dev.pina.backend.api.dto;

public record AdminStorageSummaryDto(String storageProvider, long totalPhotos, long totalVariants,
		long totalStorageBytes, long filesystemUsedBytes, long filesystemAvailableBytes) {
}
