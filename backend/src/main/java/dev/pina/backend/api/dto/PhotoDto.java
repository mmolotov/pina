package dev.pina.backend.api.dto;

import dev.pina.backend.domain.Photo;
import dev.pina.backend.domain.PhotoVariant;
import dev.pina.backend.service.PhotoGeoProjection;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record PhotoDto(UUID id, UUID uploaderId, String originalFilename, String mimeType, Integer width,
		Integer height, long sizeBytes, UUID personalLibraryId, String exifData, OffsetDateTime takenAt,
		Double latitude, Double longitude, OffsetDateTime createdAt, List<VariantDto> variants) {

	public record VariantDto(String type, String format, int width, int height, long sizeBytes) {

		public static VariantDto from(PhotoVariant v) {
			return new VariantDto(v.variantType.name(), v.format, v.width, v.height, v.sizeBytes);
		}
	}

	public static PhotoDto from(Photo p) {
		return new PhotoDto(p.id, p.uploader.id, p.originalFilename, p.mimeType, p.width, p.height, p.sizeBytes,
				p.personalLibrary.id, p.exifData, p.takenAt, p.latitude, p.longitude, p.createdAt,
				p.variants.stream().map(VariantDto::from).toList());
	}

	public static PhotoDto from(PhotoGeoProjection p) {
		return new PhotoDto(p.id(), p.uploaderId(), p.originalFilename(), p.mimeType(), p.width(), p.height(),
				p.sizeBytes(), p.personalLibraryId(), null, p.takenAt(), p.latitude(), p.longitude(), p.createdAt(),
				List.of());
	}
}
