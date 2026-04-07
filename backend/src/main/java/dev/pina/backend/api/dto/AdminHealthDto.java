package dev.pina.backend.api.dto;

public record AdminHealthDto(String status, String version, DatabaseHealth database, StorageHealth storage,
		JvmHealth jvm) {

	public record DatabaseHealth(boolean connected, String version) {
	}

	public record StorageHealth(String provider, long usedBytes, long availableBytes) {
	}

	public record JvmHealth(long heapUsedBytes, long heapMaxBytes, long nonHeapUsedBytes, int availableProcessors) {
	}
}
