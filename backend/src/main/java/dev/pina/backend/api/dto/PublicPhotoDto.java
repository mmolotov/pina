package dev.pina.backend.api.dto;

import dev.pina.backend.domain.Photo;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record PublicPhotoDto(UUID id, String originalFilename, String mimeType, Integer width, Integer height,
		long sizeBytes, OffsetDateTime takenAt, OffsetDateTime createdAt, List<PhotoDto.VariantDto> variants) {

	public static PublicPhotoDto from(Photo photo) {
		return new PublicPhotoDto(photo.id, photo.originalFilename, photo.mimeType, photo.width, photo.height,
				photo.sizeBytes, photo.takenAt, photo.createdAt,
				photo.variants.stream().map(PhotoDto.VariantDto::from).toList());
	}
}
