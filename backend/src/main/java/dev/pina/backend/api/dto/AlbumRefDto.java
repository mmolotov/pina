package dev.pina.backend.api.dto;

import dev.pina.backend.service.AlbumRef;
import java.util.UUID;

/**
 * API shape for a minimal album reference (id + name) attached to geo photos.
 */
public record AlbumRefDto(UUID id, String name) {

	public static AlbumRefDto from(AlbumRef ref) {
		return new AlbumRefDto(ref.id(), ref.name());
	}
}
