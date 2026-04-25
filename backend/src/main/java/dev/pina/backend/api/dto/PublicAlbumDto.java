package dev.pina.backend.api.dto;

import dev.pina.backend.domain.Photo;
import dev.pina.backend.service.AlbumSummary;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record PublicAlbumDto(UUID id, String name, String description, OffsetDateTime createdAt,
		OffsetDateTime updatedAt, UUID coverPhotoId, List<PhotoDto.VariantDto> coverVariants, long photoCount,
		OffsetDateTime mediaRangeStart, OffsetDateTime mediaRangeEnd, OffsetDateTime latestPhotoAddedAt) {

	public static PublicAlbumDto fromSummary(AlbumSummary summary) {
		Photo cover = summary.resolvedCoverPhoto();
		return new PublicAlbumDto(summary.album().id, summary.album().name, summary.album().description,
				summary.album().createdAt, summary.album().updatedAt, cover == null ? null : cover.id,
				cover == null ? List.of() : cover.variants.stream().map(PhotoDto.VariantDto::from).toList(),
				summary.photoCount(), summary.mediaRangeStart(), summary.mediaRangeEnd(), summary.latestPhotoAddedAt());
	}
}
