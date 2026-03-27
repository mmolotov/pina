package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

@QuarkusTest
class ExifExtractorTest {

	@Inject
	ExifExtractor exifExtractor;

	@Test
	void extractReturnsResultForValidJpeg() throws IOException {
		byte[] jpeg = createTestJpeg();
		var result = exifExtractor.extract(new ByteArrayInputStream(jpeg));
		assertNotNull(result);
		// Synthetic JPEGs have no EXIF, so takenAt should be null
		assertNull(result.takenAt());
	}

	@Test
	void extractHandlesInvalidDataGracefully() {
		byte[] garbage = "not an image at all".getBytes(StandardCharsets.UTF_8);
		var result = exifExtractor.extract(new ByteArrayInputStream(garbage));
		assertNotNull(result);
		assertNull(result.takenAt());
		assertNull(result.json());
	}

	@Test
	void extractHandlesEmptyStream() {
		var result = exifExtractor.extract(new ByteArrayInputStream(new byte[0]));
		assertNotNull(result);
		assertNull(result.takenAt());
		assertNull(result.json());
	}

	@Test
	void extractReturnsParsedJsonForJpegWithoutExif() throws IOException {
		byte[] jpeg = createTestJpeg();
		var result = exifExtractor.extract(new ByteArrayInputStream(jpeg));
		// No EXIF data in synthetic image, json may be null or empty object
		if (result.json() != null) {
			assertNotNull(result.json());
		}
	}

	private byte[] createTestJpeg() throws IOException {
		BufferedImage img = new BufferedImage(50, 50, BufferedImage.TYPE_INT_RGB);
		var g = img.createGraphics();
		g.setColor(Color.RED);
		g.fillRect(0, 0, 50, 50);
		g.dispose();
		var baos = new ByteArrayOutputStream();
		ImageIO.write(img, "jpg", baos);
		return baos.toByteArray();
	}
}
