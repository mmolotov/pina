package dev.pina.backend.api.dto;

/**
 * Aggregated instance snapshot for the admin Overview section: headline counts,
 * storage rollups, and a compact system state (DB/JVM) composed from the
 * per-section admin services.
 */
public record AdminOverviewDto(long totalUsers, long activeUsers, long adminUsers, long totalSpaces, long activeInvites,
		long totalPhotos, long totalVariants, long totalStorageBytes, long filesystemUsedBytes,
		long filesystemAvailableBytes, String storageProvider, String status, String version, boolean databaseConnected,
		long jvmHeapUsedBytes, long jvmHeapMaxBytes) {
}
