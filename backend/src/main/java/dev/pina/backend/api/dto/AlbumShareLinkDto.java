package dev.pina.backend.api.dto;

import dev.pina.backend.domain.AlbumShareLink;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AlbumShareLinkDto(UUID id, UUID albumId, UUID createdById, OffsetDateTime createdAt,
		OffsetDateTime expiresAt, OffsetDateTime revokedAt) {

	public static AlbumShareLinkDto from(AlbumShareLink link) {
		return new AlbumShareLinkDto(link.id, link.album.id, link.createdBy != null ? link.createdBy.id : null,
				link.createdAt, link.expiresAt, link.revokedAt);
	}
}
