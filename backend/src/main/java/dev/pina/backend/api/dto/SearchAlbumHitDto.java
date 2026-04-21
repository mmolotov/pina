package dev.pina.backend.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import dev.pina.backend.service.SearchService;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SearchAlbumHitDto(AlbumDto album, UUID spaceId, String spaceName) {

	public static SearchAlbumHitDto from(SearchService.SearchHit hit) {
		return new SearchAlbumHitDto(AlbumDto.from(hit.album()), hit.spaceId(), hit.spaceName());
	}
}
