package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.pina.backend.TestUserHelper;
import dev.pina.backend.domain.Album;
import dev.pina.backend.domain.AlbumPhoto;
import dev.pina.backend.domain.Photo;
import dev.pina.backend.domain.User;
import dev.pina.backend.pagination.PageRequest;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.transaction.UserTransaction;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
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

	@Inject
	AlbumLockingTestHelper lockingTestHelper;

	@Inject
	UserTransaction tx;

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

	@Test
	@Transactional
	void removePhotoReturnsNotFoundWhenReferenceDisappearsBeforeDelete() throws IOException {
		User user = TestUserHelper.createUser("album-remove-race");
		Album album = albumService.create("Race album", null, user);
		Photo photo = uploadPhoto("race-remove.jpg", user, Color.PINK);

		assertEquals(AlbumService.AddPhotoResult.CREATED, albumService.addPhoto(album.id, photo.id, user));
		AlbumPhoto albumPhoto = albumService.findAlbumPhotoForRemoval(album.id, photo.id).orElseThrow();

		assertEquals(1,
				em.createQuery("DELETE FROM AlbumPhoto ap WHERE ap.album.id = :albumId AND ap.photo.id = :photoId")
						.setParameter("albumId", album.id).setParameter("photoId", photo.id).executeUpdate());
		em.flush();

		var result = albumService.removeFetchedPhotoReference(album.id, photo.id, albumPhoto, user, true);

		assertEquals(AlbumService.RemovePhotoResult.NOT_FOUND, result);
	}

	@Test
	void setCoverPhotoWaitsForAlbumWriteLock() throws Exception {
		var setup = createAlbumWithPhotoForLockTest("album-cover-lock", "Locked cover", "locked-cover.jpg",
				Color.ORANGE);

		CountDownLatch locked = new CountDownLatch(1);
		CountDownLatch release = new CountDownLatch(1);
		ExecutorService executor = Executors.newFixedThreadPool(2);
		try {
			var lockFuture = executor
					.submit(() -> lockingTestHelper.holdAlbumWriteLock(setup.albumId(), locked, release));
			assertTrue(locked.await(5, TimeUnit.SECONDS), "expected helper to acquire the album lock");

			var resultFuture = CompletableFuture
					.supplyAsync(() -> albumService.setCoverPhoto(setup.albumId(), setup.photoId()), executor);

			Thread.sleep(200);
			assertFalse(resultFuture.isDone(), "setCoverPhoto should wait for the existing album write lock");

			release.countDown();
			var result = resultFuture.get(5, TimeUnit.SECONDS);
			assertTrue(result instanceof AlbumService.SetCoverResult.Set);
			assertEquals(setup.photoId(), ((AlbumService.SetCoverResult.Set) result).album().coverPhoto.id);
			lockFuture.get(5, TimeUnit.SECONDS);
		} finally {
			release.countDown();
			executor.shutdownNow();
		}
	}

	@Test
	void clearCoverPhotoWaitsForAlbumWriteLock() throws Exception {
		var setup = createAlbumWithPhotoForLockTest("album-clear-lock", "Locked clear", "locked-clear.jpg", Color.BLUE);
		var setResult = albumService.setCoverPhoto(setup.albumId(), setup.photoId());
		assertTrue(setResult instanceof AlbumService.SetCoverResult.Set);
		assertEquals(setup.photoId(), ((AlbumService.SetCoverResult.Set) setResult).album().coverPhoto.id);

		CountDownLatch locked = new CountDownLatch(1);
		CountDownLatch release = new CountDownLatch(1);
		ExecutorService executor = Executors.newFixedThreadPool(2);
		try {
			var lockFuture = executor
					.submit(() -> lockingTestHelper.holdAlbumWriteLock(setup.albumId(), locked, release));
			assertTrue(locked.await(5, TimeUnit.SECONDS), "expected helper to acquire the album lock");

			var resultFuture = CompletableFuture.supplyAsync(() -> albumService.clearCoverPhoto(setup.albumId()),
					executor);

			Thread.sleep(200);
			assertFalse(resultFuture.isDone(), "clearCoverPhoto should wait for the existing album write lock");

			release.countDown();
			var result = resultFuture.get(5, TimeUnit.SECONDS);
			assertTrue(result.isPresent());
			assertNull(result.orElseThrow().coverPhoto);
			lockFuture.get(5, TimeUnit.SECONDS);
		} finally {
			release.countDown();
			executor.shutdownNow();
		}
	}

	@Test
	@Transactional
	void getSummaryReturnsEmptyPreviewsForEmptyAlbum() {
		User user = TestUserHelper.createUser("album-svc");
		Album album = albumService.create("Empty preview", null, user);

		var summary = albumService.getSummary(album);

		assertEquals(0L, summary.photoCount());
		assertTrue(summary.previewPhotos().isEmpty());
	}

	@Test
	@Transactional
	void getSummaryCapsPreviewsAndOrdersByTakenAtDesc() throws IOException {
		User user = TestUserHelper.createUser("album-svc");
		Album album = albumService.create("Top previews", null, user);

		Photo p1 = uploadPhoto("preview-1.jpg", user, Color.RED);
		Photo p2 = uploadPhoto("preview-2.jpg", user, Color.GREEN);
		Photo p3 = uploadPhoto("preview-3.jpg", user, Color.BLUE);
		Photo p4 = uploadPhoto("preview-4.jpg", user, Color.YELLOW);
		Photo p5 = uploadPhoto("preview-5.jpg", user, Color.CYAN);

		albumService.addPhoto(album.id, p1.id, user);
		albumService.addPhoto(album.id, p2.id, user);
		albumService.addPhoto(album.id, p3.id, user);
		albumService.addPhoto(album.id, p4.id, user);
		albumService.addPhoto(album.id, p5.id, user);

		// Pin takenAt so the order is independent of upload jitter.
		setTakenAt(p1.id, "2025-01-01T00:00:00Z");
		setTakenAt(p2.id, "2025-01-02T00:00:00Z");
		setTakenAt(p3.id, "2025-01-03T00:00:00Z");
		setTakenAt(p4.id, "2025-01-04T00:00:00Z");
		setTakenAt(p5.id, "2025-01-05T00:00:00Z");
		em.flush();
		em.clear();

		var summary = albumService.getSummary(em.find(Album.class, album.id));

		List<UUID> previewIds = summary.previewPhotos().stream().map(p -> p.id).toList();
		assertEquals(AlbumService.MAX_PREVIEW_PHOTOS, previewIds.size());
		assertEquals(List.of(p5.id, p4.id, p3.id, p2.id), previewIds);
	}

	@Test
	@Transactional
	void buildSummariesPopulatesPreviewsPerAlbumIndependently() throws IOException {
		User user = TestUserHelper.createUser("album-svc");
		Album albumA = albumService.create("A", null, user);
		Album albumB = albumService.create("B", null, user);

		Photo a1 = uploadPhoto("multi-a-1.jpg", user, Color.RED);
		Photo a2 = uploadPhoto("multi-a-2.jpg", user, Color.GREEN);
		Photo b1 = uploadPhoto("multi-b-1.jpg", user, Color.BLUE);

		albumService.addPhoto(albumA.id, a1.id, user);
		albumService.addPhoto(albumA.id, a2.id, user);
		albumService.addPhoto(albumB.id, b1.id, user);

		setTakenAt(a1.id, "2025-02-01T00:00:00Z");
		setTakenAt(a2.id, "2025-02-02T00:00:00Z");
		setTakenAt(b1.id, "2025-03-01T00:00:00Z");
		em.flush();
		em.clear();

		List<AlbumSummary> summaries = albumService
				.buildSummaries(List.of(em.find(Album.class, albumA.id), em.find(Album.class, albumB.id)));

		assertEquals(2, summaries.size());
		assertEquals(List.of(a2.id, a1.id), summaries.get(0).previewPhotos().stream().map(p -> p.id).toList());
		assertEquals(List.of(b1.id), summaries.get(1).previewPhotos().stream().map(p -> p.id).toList());
	}

	private void setTakenAt(UUID photoId, String iso) {
		em.createNativeQuery("UPDATE photos SET taken_at = ?1 WHERE id = ?2")
				.setParameter(1, Timestamp.from(OffsetDateTime.parse(iso).toInstant())).setParameter(2, photoId)
				.executeUpdate();
	}

	private record AlbumCoverLockSetup(UUID albumId, UUID photoId) {
	}

	private AlbumCoverLockSetup createAlbumWithPhotoForLockTest(String username, String albumName, String filename,
			Color color) throws Exception {
		tx.begin();
		try {
			User user = TestUserHelper.createUser(username);
			Album album = albumService.create(albumName, null, user);
			Photo photo = uploadPhoto(filename, user, color);
			assertEquals(AlbumService.AddPhotoResult.CREATED, albumService.addPhoto(album.id, photo.id, user));
			tx.commit();
			return new AlbumCoverLockSetup(album.id, photo.id);
		} catch (Exception e) {
			if (tx.getStatus() == jakarta.transaction.Status.STATUS_ACTIVE) {
				tx.rollback();
			}
			throw e;
		}
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
