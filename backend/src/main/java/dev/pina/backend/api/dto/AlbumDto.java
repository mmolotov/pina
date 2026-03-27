package dev.pina.backend.api.dto;

import dev.pina.backend.domain.Album;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AlbumDto(UUID id, String name, String description, UUID ownerId, UUID personalLibraryId,
		OffsetDateTime createdAt) {

	public static AlbumDto from(Album a) {
		return new AlbumDto(a.id, a.name, a.description, a.owner.id, a.personalLibrary.id, a.createdAt);
	}
}
