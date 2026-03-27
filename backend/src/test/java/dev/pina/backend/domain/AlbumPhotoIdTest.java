package dev.pina.backend.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import io.quarkus.test.junit.QuarkusTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AlbumPhotoIdTest {

	@Test
	void equalsAndHashCodeCoverAllBranches() {
		UUID albumId = UUID.randomUUID();
		UUID photoId = UUID.randomUUID();

		AlbumPhoto.AlbumPhotoId first = new AlbumPhoto.AlbumPhotoId(albumId, photoId);
		AlbumPhoto.AlbumPhotoId same = new AlbumPhoto.AlbumPhotoId(albumId, photoId);
		AlbumPhoto.AlbumPhotoId differentAlbum = new AlbumPhoto.AlbumPhotoId(UUID.randomUUID(), photoId);
		AlbumPhoto.AlbumPhotoId differentPhoto = new AlbumPhoto.AlbumPhotoId(albumId, UUID.randomUUID());

		assertEquals(first, same);
		assertEquals(first.hashCode(), same.hashCode());
		assertNotEquals(first, differentAlbum);
		assertNotEquals(first, differentPhoto);
		assertNotNull(first);
	}
}
