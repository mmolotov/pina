package dev.pina.backend.api.dto;

import dev.pina.backend.domain.Album;
import dev.pina.backend.domain.Photo;
import dev.pina.backend.service.AlbumSummary;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Album response payload. {@code coverPhotoId} is the explicit cover when
 * chosen by the user, or the auto-resolved newest photo otherwise. Summary
 * fields ({@code photoCount}, {@code mediaRangeStart}, {@code mediaRangeEnd},
 * {@code latestPhotoAddedAt}) are populated from aggregate queries on list and
 * mutation responses so the client does not need to load every photo to render
 * an album tile.
 */
public record AlbumDto(UUID id, String name, String description, UUID ownerId, UUID personalLibraryId, UUID spaceId,
		OffsetDateTime createdAt, OffsetDateTime updatedAt, UUID coverPhotoId, List<PhotoDto.VariantDto> coverVariants,
		long photoCount, OffsetDateTime mediaRangeStart, OffsetDateTime mediaRangeEnd,
		OffsetDateTime latestPhotoAddedAt) {

	public static AlbumDto from(Album a) {
		return new AlbumDto(a.id, a.name, a.description, a.owner.id,
				a.personalLibrary != null ? a.personalLibrary.id : null, a.space != null ? a.space.id : null,
				a.createdAt, a.updatedAt, null, List.of(), 0L, null, null, null);
	}

	public static AlbumDto fromSummary(AlbumSummary summary) {
		Album a = summary.album();
		Photo cover = summary.resolvedCoverPhoto();
		UUID coverId = cover == null ? null : cover.id;
		List<PhotoDto.VariantDto> coverVariants = cover == null
				? List.of()
				: cover.variants.stream().map(PhotoDto.VariantDto::from).toList();
		return new AlbumDto(a.id, a.name, a.description, a.owner.id,
				a.personalLibrary != null ? a.personalLibrary.id : null, a.space != null ? a.space.id : null,
				a.createdAt, a.updatedAt, coverId, coverVariants, summary.photoCount(), summary.mediaRangeStart(),
				summary.mediaRangeEnd(), summary.latestPhotoAddedAt());
	}
}
