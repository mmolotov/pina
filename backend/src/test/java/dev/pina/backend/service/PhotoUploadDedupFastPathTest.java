package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import dev.pina.backend.TestUserHelper;
import dev.pina.backend.domain.PersonalLibrary;
import dev.pina.backend.domain.Photo;
import dev.pina.backend.domain.User;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

/**
 * Verifies the cheap dedup short-circuit in {@link PhotoService#upload}: when a
 * Photo with the same {@code (uploader_id, content_hash)} already exists, the
 * upload must return it without paying the cost of
 * {@link ImageProcessor#readImage} (full image decode) or
 * {@link ExifExtractor#extract} (EXIF parsing).
 */
@QuarkusTest
class PhotoUploadDedupFastPathTest {

	@Inject
	PhotoService photoService;

	@InjectMock
	ImageProcessor imageProcessor;

	@InjectMock
	ExifExtractor exifExtractor;

	@Test
	void duplicateUploadReturnsExistingPhotoWithoutDecodeOrExif() throws IOException {
		User user = TestUserHelper.createUser("dedup-fast-path");
		byte[] jpegBytes = createJpegBytes(Color.PINK, 80, 60);
		String contentHash = sha256Hex(jpegBytes);

		// Pre-insert a Photo with the matching content hash, simulating an earlier
		// successful upload by the same user. We bypass PhotoService here so the
		// dedup row exists before we exercise the upload fast path.
		UUID seededPhotoId = QuarkusTransaction.requiringNew().call(() -> {
			PersonalLibrary library = PersonalLibrary.<PersonalLibrary>find("owner.id", user.id).firstResult();
			Photo seeded = new Photo();
			seeded.id = UUID.randomUUID();
			seeded.uploader = user;
			seeded.personalLibrary = library;
			seeded.contentHash = contentHash;
			seeded.originalFilename = "seeded.jpg";
			seeded.mimeType = "image/jpeg";
			seeded.width = 80;
			seeded.height = 60;
			seeded.sizeBytes = (long) jpegBytes.length;
			seeded.persistAndFlush();
			return seeded.id;
		});

		Photo result = photoService.upload(new ByteArrayInputStream(jpegBytes), "duplicate.jpg", "image/jpeg", user);

		assertEquals(seededPhotoId, result.id, "dedup must return the pre-existing Photo without re-creating it");
		verify(imageProcessor, never()).readImage(any(Path.class));
		verify(imageProcessor, never()).readImage(any(InputStream.class));
		verify(exifExtractor, never()).extract(any(Path.class));
		verify(exifExtractor, never()).extract(any(InputStream.class));
	}

	private static byte[] createJpegBytes(Color color, int width, int height) throws IOException {
		BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
		var g = image.createGraphics();
		g.setColor(color);
		g.fillRect(0, 0, width, height);
		g.dispose();
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		ImageIO.write(image, "jpg", out);
		return out.toByteArray();
	}

	private static String sha256Hex(byte[] data) {
		try {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			return HexFormat.of().formatHex(digest.digest(data));
		} catch (NoSuchAlgorithmException e) {
			throw new AssertionError("SHA-256 must be available", e);
		}
	}
}
