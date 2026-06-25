package dev.pina.backend.api.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import dev.pina.backend.service.AlbumRef;
import dev.pina.backend.service.PhotoGeoProjection;
import java.util.List;

/**
 * Map-marker payload: a geo photo plus the personal albums it belongs to. The
 * photo fields are unwrapped so the JSON stays flat ({@code {...photoFields,
 * albums:[...]}}), keeping the response shape compatible with the regular photo
 * payload while adding album membership for the map's album filter.
 */
public record GeoPhotoDto(@JsonUnwrapped PhotoDto photo, List<AlbumRefDto> albums) {

	public static GeoPhotoDto from(PhotoGeoProjection projection, List<AlbumRef> albums) {
		return new GeoPhotoDto(PhotoDto.from(projection), albums.stream().map(AlbumRefDto::from).toList());
	}
}
