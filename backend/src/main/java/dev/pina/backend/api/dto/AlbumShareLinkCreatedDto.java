package dev.pina.backend.api.dto;

import dev.pina.backend.domain.AlbumShareLink;

public record AlbumShareLinkCreatedDto(AlbumShareLinkDto link, String token) {

	public static AlbumShareLinkCreatedDto of(AlbumShareLink link, String token) {
		return new AlbumShareLinkCreatedDto(AlbumShareLinkDto.from(link), token);
	}
}
