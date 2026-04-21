package dev.pina.backend.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import dev.pina.backend.service.SearchService;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SearchPhotoHitDto(PhotoDto photo, UUID albumId, String albumName, UUID spaceId, String spaceName) {

	public static SearchPhotoHitDto from(SearchService.SearchHit hit) {
		return new SearchPhotoHitDto(PhotoDto.from(hit.photo()), hit.albumId(), hit.albumName(), hit.spaceId(),
				hit.spaceName());
	}
}
