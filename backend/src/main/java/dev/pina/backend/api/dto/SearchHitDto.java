package dev.pina.backend.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import dev.pina.backend.service.SearchService;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SearchHitDto(String kind, String entryScope, boolean favorited, SearchPhotoHitDto photo,
		SearchAlbumHitDto album) {

	public static SearchHitDto from(SearchService.SearchHit hit) {
		return new SearchHitDto(hit.kind().name(), hit.entryScope().name(), hit.favorited(),
				hit.kind() == SearchService.SearchResultKind.PHOTO ? SearchPhotoHitDto.from(hit) : null,
				hit.kind() == SearchService.SearchResultKind.ALBUM ? SearchAlbumHitDto.from(hit) : null);
	}
}
