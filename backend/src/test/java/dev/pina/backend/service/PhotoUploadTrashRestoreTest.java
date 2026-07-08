package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.pina.backend.TestUserHelper;
import dev.pina.backend.domain.Photo;
import dev.pina.backend.domain.User;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

/**
 * Re-uploading content that sits in the caller's trash must restore the trashed
 * photo instead of failing: the {@code (uploader_id, content_hash)} unique
 * index still holds the trashed row, so a plain insert can never succeed, and
 * the entity-level {@code @SQLRestriction} hides the row from the regular dedup
 * lookup.
 */
@QuarkusTest
class PhotoUploadTrashRestoreTest {

	@Inject
	PhotoService photoService;

	@Inject
	EntityManager em;

	@Test
	void reuploadOfTrashedContentRestoresThePhoto() throws IOException {
		User user = TestUserHelper.createUser("trash-reupload");
		byte[] jpegBytes = jpegBytes(Color.MAGENTA, 72, 48);

		Photo original = photoService.upload(new ByteArrayInputStream(jpegBytes), "original.jpg", "image/jpeg", user);
		assertEquals(PhotoService.DeleteResult.DELETED, photoService.delete(original.id));
		assertTrue(photoService.findById(original.id).isEmpty(), "trashed photo must be hidden from normal reads");

		Photo reuploaded = photoService.upload(new ByteArrayInputStream(jpegBytes), "again.jpg", "image/jpeg", user);

		assertEquals(original.id, reuploaded.id, "re-upload must resurrect the trashed row, not create a new one");
		assertTrue(photoService.findById(original.id).isPresent(), "restored photo must be visible again");
		assertNull(scalar("SELECT deleted_at FROM photos WHERE id = :id", original.id),
				"deleted_at must be cleared by the restore");
	}

	@Test
	void reuploadOfTrashedContentReactivatesFailedAnalysisJob() throws IOException {
		User user = TestUserHelper.createUser("trash-reupload-ml");
		byte[] jpegBytes = jpegBytes(Color.DARK_GRAY, 66, 44);

		Photo photo = photoService.upload(new ByteArrayInputStream(jpegBytes), "job.jpg", "image/jpeg", user);
		// Simulate the worker having given up while the photo was trashed
		// (e.g. "photo no longer exists" or max attempts exceeded).
		QuarkusTransaction.requiringNew()
				.run(() -> em
						.createNativeQuery("INSERT INTO photo_analysis_jobs (photo_id, status, attempts, last_error) "
								+ "VALUES (:photoId, 'FAILED', 5, 'photo no longer exists')")
						.setParameter("photoId", photo.id).executeUpdate());
		photoService.delete(photo.id);

		photoService.upload(new ByteArrayInputStream(jpegBytes), "job-again.jpg", "image/jpeg", user);

		assertEquals("PENDING", scalar("SELECT status FROM photo_analysis_jobs WHERE photo_id = :id", photo.id),
				"a FAILED analysis job must be re-queued when its photo returns from the trash");
		assertEquals(0, ((Number) scalar("SELECT attempts FROM photo_analysis_jobs WHERE photo_id = :id", photo.id))
				.intValue());
	}

	@Test
	void reuploadByAnotherUserStillCreatesTheirOwnPhoto() throws IOException {
		User owner = TestUserHelper.createUser("trash-owner");
		User other = TestUserHelper.createUser("trash-other");
		byte[] jpegBytes = jpegBytes(Color.LIGHT_GRAY, 52, 40);

		Photo owned = photoService.upload(new ByteArrayInputStream(jpegBytes), "mine.jpg", "image/jpeg", owner);
		photoService.delete(owned.id);

		Photo theirs = photoService.upload(new ByteArrayInputStream(jpegBytes), "theirs.jpg", "image/jpeg", other);

		assertNotNull(theirs.id);
		assertNotEquals(owned.id, theirs.id, "per-uploader dedup must not leak another user's trashed photo");
		assertTrue(photoService.findById(owned.id).isEmpty(), "the owner's photo must stay in the trash");
	}

	private Object scalar(String sql, UUID id) {
		return QuarkusTransaction.requiringNew()
				.call(() -> em.createNativeQuery(sql).setParameter("id", id).getSingleResult());
	}

	private static byte[] jpegBytes(Color color, int width, int height) throws IOException {
		BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
		var graphics = image.createGraphics();
		graphics.setColor(color);
		graphics.fillRect(0, 0, width, height);
		graphics.dispose();
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		ImageIO.write(image, "jpg", out);
		return out.toByteArray();
	}
}
