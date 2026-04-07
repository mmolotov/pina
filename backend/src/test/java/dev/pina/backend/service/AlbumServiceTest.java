package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.pina.backend.TestUserHelper;
import dev.pina.backend.domain.Album;
import dev.pina.backend.domain.Photo;
import dev.pina.backend.domain.User;
import dev.pina.backend.pagination.PageRequest;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AlbumServiceTest {

	@Inject
	AlbumService albumService;

	@Inject
	PhotoService photoService;

	@Inject
	EntityManager em;

	@Test
	void listPhotosRejectsNegativePage() {
		IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
				() -> albumService.listPhotos(UUID.randomUUID(), new PageRequest(-1, 10, false)));
		assertEquals("page must be >= 0", error.getMessage());
	}

	@Test
	void listPhotosRejectsNonPositiveSize() {
		IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
				() -> albumService.listPhotos(UUID.randomUUID(), new PageRequest(0, 0, false)));
		assertEquals("size must be > 0", error.getMessage());
	}

	@Test
	void listPhotosRejectsPageOverflow() {
		IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
				() -> albumService.listPhotos(UUID.randomUUID(), new PageRequest(Integer.MAX_VALUE, 100, false)));
		assertEquals("page is too large", error.getMessage());
	}

	@Test
	@Transactional
	void listPhotosUsesStableTiebreakerWhenAddedAtIsEqual() throws IOException {
		User user = TestUserHelper.createUser("album-svc");
		Album album = albumService.create("Stable order", "Tie-breaker test", user);

		Photo first = uploadPhoto("stable-order-1.jpg", user, Color.RED);
		Photo second = uploadPhoto("stable-order-2.jpg", user, Color.GREEN);
		Photo third = uploadPhoto("stable-order-3.jpg", user, Color.BLUE);

		albumService.addPhoto(album.id, first.id, user);
		albumService.addPhoto(album.id, second.id, user);
		albumService.addPhoto(album.id, third.id, user);

		Timestamp fixedAddedAt = Timestamp.from(OffsetDateTime.parse("2026-01-01T00:00:00Z").toInstant());
		em.createNativeQuery("UPDATE album_photos SET added_at = ?1 WHERE album_id = ?2").setParameter(1, fixedAddedAt)
				.setParameter(2, album.id).executeUpdate();
		em.flush();
		em.clear();

		@SuppressWarnings("unchecked")
		List<String> expectedOrder = em.createNativeQuery(
				"SELECT photo_id::text FROM album_photos WHERE album_id = ?1 ORDER BY added_at DESC, photo_id DESC")
				.setParameter(1, album.id).getResultList();

		List<String> firstRead = albumService.listPhotos(album.id, new PageRequest(0, 10, false)).items().stream()
				.map(photo -> photo.id.toString()).toList();
		List<String> secondRead = albumService.listPhotos(album.id, new PageRequest(0, 10, false)).items().stream()
				.map(photo -> photo.id.toString()).toList();

		assertEquals(expectedOrder, firstRead);
		assertEquals(firstRead, secondRead);
	}

	@Test
	@Transactional
	void listPhotosReturnsPaginationMetadata() throws IOException {
		User user = TestUserHelper.createUser("album-svc");
		Album album = albumService.create("Pagination metadata", null, user);

		albumService.addPhoto(album.id, uploadPhoto("pagination-1.jpg", user, Color.RED).id, user);
		albumService.addPhoto(album.id, uploadPhoto("pagination-2.jpg", user, Color.GREEN).id, user);

		var page = albumService.listPhotos(album.id, new PageRequest(0, 1, true));

		assertEquals(1, page.items().size());
		assertEquals(0, page.page());
		assertEquals(1, page.size());
		assertTrue(page.hasNext());
		assertEquals(2L, page.totalItems());
		assertEquals(2L, page.totalPages());
	}

	@Test
	@Transactional
	void listPhotosOmitsTotalsWhenNotRequested() throws IOException {
		User user = TestUserHelper.createUser("album-svc");
		Album album = albumService.create("No totals", null, user);

		albumService.addPhoto(album.id, uploadPhoto("no-total-1.jpg", user, Color.ORANGE).id, user);

		var page = albumService.listPhotos(album.id, new PageRequest(0, 10, false));

		assertEquals(1, page.items().size());
		assertFalse(page.hasNext());
		assertNull(page.totalItems());
		assertNull(page.totalPages());
	}

	@Test
	@Transactional
	void addPhotoReturnsNotFoundWhenAlbumNotExists() throws IOException {
		User user = TestUserHelper.createUser("album-add-no-album");
		Photo photo = uploadPhoto("add-no-album.jpg", user, Color.CYAN);
		var result = albumService.addPhoto(UUID.randomUUID(), photo.id, user);
		assertEquals(AlbumService.AddPhotoResult.NOT_FOUND, result);
	}

	@Test
	@Transactional
	void addPhotoReturnsNotFoundWhenPhotoNotExists() {
		User user = TestUserHelper.createUser("album-add-no-photo");
		Album album = albumService.create("AddNoPhoto", null, user);
		var result = albumService.addPhoto(album.id, UUID.randomUUID(), user);
		assertEquals(AlbumService.AddPhotoResult.NOT_FOUND, result);
	}

	@Test
	@Transactional
	void addPhotoReturnsPhotoNotAccessibleWhenPhotoOwnedByOther() throws IOException {
		User owner = TestUserHelper.createUser("album-owner");
		User other = TestUserHelper.createUser("album-other");
		Album album = albumService.create("OwnerAlbum", null, owner);
		Photo photo = uploadPhoto("other-owned.jpg", other, Color.MAGENTA);
		var result = albumService.addPhoto(album.id, photo.id, owner);
		assertEquals(AlbumService.AddPhotoResult.PHOTO_NOT_ACCESSIBLE, result);
	}

	@Test
	@Transactional
	void updateReturnsEmptyForNonExistentAlbum() {
		assertTrue(albumService.update(UUID.randomUUID(), "New Name", null).isEmpty());
	}

	private Photo uploadPhoto(String filename, User user, Color color) throws IOException {
		return photoService.upload(new ByteArrayInputStream(createJpegBytes(color, filename)), filename, "image/jpeg",
				user);
	}

	private byte[] createJpegBytes(Color color, String salt) throws IOException {
		BufferedImage image = new BufferedImage(100, 100, BufferedImage.TYPE_INT_RGB);
		var g = image.createGraphics();
		g.setColor(color);
		g.fillRect(0, 0, image.getWidth(), image.getHeight());
		g.dispose();
		image.setRGB(0, 0, salt.hashCode());

		ByteArrayOutputStream out = new ByteArrayOutputStream();
		ImageIO.write(image, "jpg", out);
		return out.toByteArray();
	}
}
