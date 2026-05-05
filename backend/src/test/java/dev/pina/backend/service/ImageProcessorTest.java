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
		try (ProcessedImage result = imageProcessor.compress(source)) {
			assertNotNull(result);
			assertTrue(result.width() <= 2560);
			assertTrue(result.height() <= 2560);
			assertTrue(result.sizeBytes() > 0);
			assertEquals("jpeg", result.format());
		}
	}

	@Test
	void compressDoesNotUpscaleSmallImage() throws IOException {
		BufferedImage source = createTestBufferedImage(100, 80);
		try (ProcessedImage result = imageProcessor.compress(source)) {
			assertEquals(100, result.width());
			assertEquals(80, result.height());
		}
	}

	@Test
	void thumbnailPyramidProducesSquareXsAndSmAndConstrainedMdLgForLandscape() throws IOException {
		BufferedImage source = createTestBufferedImage(3000, 2000);
		ImageProcessor.ThumbnailPyramid pyramid = imageProcessor.thumbnailPyramid(source);
		try (ProcessedImage xs = pyramid.xs();
				ProcessedImage sm = pyramid.sm();
				ProcessedImage md = pyramid.md();
				ProcessedImage lg = pyramid.lg()) {
			assertEquals(256, xs.width());
			assertEquals(256, xs.height());
			assertEquals(512, sm.width());
			assertEquals(512, sm.height());
			assertTrue(md.width() <= 1280);
			assertTrue(lg.width() <= 1920);
			assertTrue(xs.sizeBytes() > 0);
			assertTrue(sm.sizeBytes() > 0);
			assertTrue(md.sizeBytes() > 0);
			assertTrue(lg.sizeBytes() > 0);
		}
	}

	@Test
	void thumbnailPyramidProducesConstrainedMdLgForPortrait() throws IOException {
		BufferedImage source = createTestBufferedImage(2000, 3000);
		ImageProcessor.ThumbnailPyramid pyramid = imageProcessor.thumbnailPyramid(source);
		try (ProcessedImage xs = pyramid.xs();
				ProcessedImage sm = pyramid.sm();
				ProcessedImage md = pyramid.md();
				ProcessedImage lg = pyramid.lg()) {
			assertEquals(256, xs.width());
			assertEquals(256, xs.height());
			assertEquals(512, sm.width());
			assertEquals(512, sm.height());
			// Aspect-preserving thumbnails fit within the configured max dimension on
			// both axes; for portrait sources the height is the constrained dimension.
			assertTrue(md.height() <= 1280);
			assertTrue(lg.height() <= 1920);
		}
	}

	@Test
	void thumbnailPyramidStaysWithinBoundsForSmallSource() throws IOException {
		BufferedImage source = createTestBufferedImage(100, 80);
		ImageProcessor.ThumbnailPyramid pyramid = imageProcessor.thumbnailPyramid(source);
		try (ProcessedImage xs = pyramid.xs();
				ProcessedImage sm = pyramid.sm();
				ProcessedImage md = pyramid.md();
				ProcessedImage lg = pyramid.lg()) {
			assertEquals(256, xs.width());
			assertEquals(256, xs.height());
			assertEquals(512, sm.width());
			assertEquals(512, sm.height());
			assertTrue(md.width() <= 1280);
			assertTrue(lg.width() <= 1920);
		}
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
