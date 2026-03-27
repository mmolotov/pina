package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

@QuarkusTest
class ImageProcessorTest {

	@Inject
	ImageProcessor imageProcessor;

	@Test
	void readImageReturnsBufferedImageForValidJpeg() throws IOException {
		byte[] jpegBytes = createTestJpeg(200, 150);
		BufferedImage image = imageProcessor.readImage(new ByteArrayInputStream(jpegBytes));
		assertNotNull(image);
		assertEquals(200, image.getWidth());
		assertEquals(150, image.getHeight());
	}

	@Test
	void readImageReturnsNullForInvalidData() throws IOException {
		byte[] garbage = "not an image".getBytes(java.nio.charset.StandardCharsets.UTF_8);
		BufferedImage image = imageProcessor.readImage(new ByteArrayInputStream(garbage));
		assertNull(image);
	}

	@Test
	void compressReturnsDownscaledImage() throws IOException {
		BufferedImage source = createTestBufferedImage(4000, 3000);
		ProcessedImage result = imageProcessor.compress(source);
		assertNotNull(result);
		assertTrue(result.width() <= 2560);
		assertTrue(result.height() <= 2560);
		assertTrue(result.sizeBytes() > 0);
		assertEquals("jpeg", result.format());
	}

	@Test
	void compressDoesNotUpscaleSmallImage() throws IOException {
		BufferedImage source = createTestBufferedImage(100, 80);
		ProcessedImage result = imageProcessor.compress(source);
		assertEquals(100, result.width());
		assertEquals(80, result.height());
	}

	@Test
	void thumbnailSmIsSquareConstrained() throws IOException {
		BufferedImage source = createTestBufferedImage(800, 600);
		ProcessedImage thumb = imageProcessor.thumbnailSm(source);
		assertNotNull(thumb);
		assertEquals(256, thumb.width());
		assertEquals(256, thumb.height());
		assertTrue(thumb.sizeBytes() > 0);
	}

	@Test
	void thumbnailMdRespectsMaxWidth() throws IOException {
		BufferedImage source = createTestBufferedImage(3000, 2000);
		ProcessedImage thumb = imageProcessor.thumbnailMd(source);
		assertNotNull(thumb);
		assertTrue(thumb.width() <= 1280);
		assertTrue(thumb.sizeBytes() > 0);
	}

	@Test
	void thumbnailLgRespectsMaxWidth() throws IOException {
		BufferedImage source = createTestBufferedImage(3000, 2000);
		ProcessedImage thumb = imageProcessor.thumbnailLg(source);
		assertNotNull(thumb);
		assertTrue(thumb.width() <= 1920);
		assertTrue(thumb.sizeBytes() > 0);
	}

	@Test
	void thumbnailSmallImageStaysWithinBounds() throws IOException {
		BufferedImage source = createTestBufferedImage(100, 80);
		ProcessedImage thumb = imageProcessor.thumbnailSm(source);
		assertEquals(256, thumb.width());
		assertEquals(256, thumb.height());
		assertTrue(thumb.sizeBytes() > 0);
	}

	private BufferedImage createTestBufferedImage(int width, int height) {
		BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
		var g = img.createGraphics();
		g.setColor(Color.BLUE);
		g.fillRect(0, 0, width, height);
		g.dispose();
		return img;
	}

	private byte[] createTestJpeg(int width, int height) throws IOException {
		BufferedImage img = createTestBufferedImage(width, height);
		var baos = new ByteArrayOutputStream();
		ImageIO.write(img, "jpg", baos);
		return baos.toByteArray();
	}
}
