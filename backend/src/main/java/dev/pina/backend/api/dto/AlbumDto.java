package dev.pina.backend.api.dto;

import dev.pina.backend.domain.Album;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AlbumDto(UUID id, String name, String description, UUID ownerId, UUID personalLibraryId, UUID spaceId,
		OffsetDateTime createdAt, OffsetDateTime updatedAt) {

	public static AlbumDto from(Album a) {
		return new AlbumDto(a.id, a.name, a.description, a.owner.id,
				a.personalLibrary != null ? a.personalLibrary.id : null, a.space != null ? a.space.id : null,
				a.createdAt, a.updatedAt);
	}
}
