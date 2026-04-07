package dev.pina.backend.api.dto;

public record AdminSettingsDto(String registrationMode, String compressionFormat, int compressionQuality,
		int compressionMaxResolution) {
}
