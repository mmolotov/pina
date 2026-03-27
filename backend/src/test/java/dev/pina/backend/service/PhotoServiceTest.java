package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.pina.backend.domain.Album;
import dev.pina.backend.domain.Photo;
import dev.pina.backend.domain.User;
import dev.pina.backend.domain.VariantType;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Optional;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

@QuarkusTest
class PhotoServiceTest {

	@Inject
	PhotoService photoService;

	@Inject
	AlbumService albumService;

	@Inject
	UserResolver userResolver;

	@Test
	@Transactional
	void uploadCreatesPhotoWithVariants() throws IOException {
		User user = userResolver.currentUser();
		Photo photo = photoService.upload(jpegStream(Color.CYAN, 200, 150), "test.jpg", "image/jpeg", user);

		assertNotNull(photo.id);
		assertEquals("image/jpeg", photo.mimeType);
		assertEquals("test.jpg", photo.originalFilename);
		assertEquals(200, photo.width);
		assertEquals(150, photo.height);
		assertNotNull(photo.contentHash);
		assertNotNull(photo.personalLibrary);
		// storeOriginal=true by default: ORIGINAL + COMPRESSED + 3 thumbnails = 5
		assertEquals(5, photo.variants.size());
	}

	@Test
	@Transactional
	void uploadDeduplicatesByContentHash() throws IOException {
		User user = userResolver.currentUser();
		byte[] imageBytes = createJpegBytes(Color.MAGENTA, 100, 100);

		Photo first = photoService.upload(new ByteArrayInputStream(imageBytes), "a.jpg", "image/jpeg", user);
		Photo second = photoService.upload(new ByteArrayInputStream(imageBytes), "b.jpg", "image/jpeg", user);

		assertEquals(first.id, second.id);
	}

	@Test
	@Transactional
	void findByIdReturnsExistingPhoto() throws IOException {
		User user = userResolver.currentUser();
		Photo photo = photoService.upload(jpegStream(Color.YELLOW, 80, 80), "find.jpg", "image/jpeg", user);

		Optional<Photo> found = photoService.findById(photo.id);
		assertTrue(found.isPresent());
		assertEquals(photo.id, found.get().id);
	}

	@Test
	@Transactional
	void deleteRemovesPhotoAndReturnsDeleted() throws IOException {
		User user = userResolver.currentUser();
		Photo photo = photoService.upload(jpegStream(Color.DARK_GRAY, 60, 60), "delete.jpg", "image/jpeg", user);

		PhotoService.DeleteResult result = photoService.delete(photo.id);
		assertEquals(PhotoService.DeleteResult.DELETED, result);

		Optional<Photo> found = photoService.findById(photo.id);
		assertTrue(found.isEmpty());
	}

	@Test
	void deleteNonExistentReturnsNotFound() {
		PhotoService.DeleteResult result = photoService.delete(java.util.UUID.randomUUID());
		assertEquals(PhotoService.DeleteResult.NOT_FOUND, result);
	}

	@Test
	@Transactional
	void deleteReferencedPhotoReturnsHasReferences() throws IOException {
		User user = userResolver.currentUser();
		Photo photo = photoService.upload(jpegStream(Color.PINK, 70, 70), "ref.jpg", "image/jpeg", user);
		Album album = albumService.create("ref-test", null, user);
		albumService.addPhoto(album.id, photo.id, user);

		PhotoService.DeleteResult result = photoService.delete(photo.id);
		assertEquals(PhotoService.DeleteResult.HAS_REFERENCES, result);
	}

	@Test
	@Transactional
	void getVariantFileReturnsStream() throws IOException {
		User user = userResolver.currentUser();
		Photo photo = photoService.upload(jpegStream(Color.ORANGE, 90, 90), "variant.jpg", "image/jpeg", user);

		InputStream stream = photoService.getVariantFile(photo, VariantType.COMPRESSED);
		assertNotNull(stream);
		byte[] data = stream.readAllBytes();
		assertTrue(data.length > 0);
	}

	@Test
	@Transactional
	void getVariantFileReturnsStreamForAllVariantTypes() throws IOException {
		User user = userResolver.currentUser();
		Photo photo = photoService.upload(jpegStream(Color.RED, 50, 50), "all-variants.jpg", "image/jpeg", user);

		for (VariantType type : VariantType.values()) {
			InputStream stream = photoService.getVariantFile(photo, type);
			assertNotNull(stream);
			stream.close();
		}
	}

	@Test
	void uploadUnsupportedImageThrows() {
		User user = userResolver.currentUser();
		byte[] notAnImage = "not an image".getBytes(java.nio.charset.StandardCharsets.UTF_8);

		assertThrows(IllegalArgumentException.class,
				() -> photoService.upload(new ByteArrayInputStream(notAnImage), "bad.jpg", "image/jpeg", user));
	}

	@Test
	@Transactional
	void uploadSetsExifAndDimensions() throws IOException {
		User user = userResolver.currentUser();
		Photo photo = photoService.upload(jpegStream(Color.BLUE, 300, 200), "exif.jpg", "image/jpeg", user);

		assertEquals(300, photo.width);
		assertEquals(200, photo.height);
		assertNotNull(photo.sizeBytes);
		assertTrue(photo.sizeBytes > 0);
	}

	@Test
	@Transactional
	void listByUploaderReturnsPhotos() throws IOException {
		User user = userResolver.currentUser();
		photoService.upload(jpegStream(Color.GREEN, 40, 40), "list1.jpg", "image/jpeg", user);
		photoService.upload(jpegStream(Color.RED, 41, 41), "list2.jpg", "image/jpeg", user);

		var photos = photoService.listByUploader(user.id, 0, 10);
		assertTrue(photos.size() >= 2);
	}

	private InputStream jpegStream(Color color, int width, int height) throws IOException {
		return new ByteArrayInputStream(createJpegBytes(color, width, height));
	}

	private byte[] createJpegBytes(Color color, int width, int height) throws IOException {
		BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
		var g = image.createGraphics();
		g.setColor(color);
		g.fillRect(0, 0, width, height);
		g.dispose();
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		ImageIO.write(image, "jpg", out);
		return out.toByteArray();
	}
}
