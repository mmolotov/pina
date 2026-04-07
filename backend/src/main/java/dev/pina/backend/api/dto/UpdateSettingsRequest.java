package dev.pina.backend.api.dto;

public record UpdateSettingsRequest(String registrationMode, String compressionFormat, Integer compressionQuality,
		Integer compressionMaxResolution) {
}
