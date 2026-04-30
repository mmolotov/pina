package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Answers.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import dev.pina.backend.config.PhotoConfig;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/**
 * Pure JUnit test (no Quarkus DI) that injects a deterministic mid-pyramid
 * failure to verify {@link ImageProcessor#thumbnailPyramid} cleans up every
 * temp file it created before propagating the failure to the caller.
 */
class ImageProcessorPyramidCleanupTest {

	@Test
	void midPyramidFailureLeavesNoTempFilesBehind() throws IOException {
		Set<Path> snapshot = listProcessedTempFiles();

		PhotoConfig config = mock(PhotoConfig.class, RETURNS_DEEP_STUBS);
		when(config.compression().format()).thenReturn("jpeg");
		when(config.compression().quality()).thenReturn(82);
		when(config.compression().maxResolution()).thenReturn(2560);
		when(config.thumbnails().lgWidth()).thenReturn(1920);
		when(config.thumbnails().mdWidth()).thenReturn(1280);
		when(config.thumbnails().smSize()).thenReturn(512);
		when(config.thumbnails().xsSize()).thenReturn(256);

		// Subclass throws on the third writeBuffered call (the SM stage), simulating
		// a mid-pyramid failure after the LG and MD temp files have already been
		// written to disk.
		IOException injected = new IOException("simulated mid-pyramid failure");
		ImageProcessor processor = new ImageProcessor() {
			int writeCalls = 0;

			@Override
			ProcessedImage writeBuffered(BufferedImage image, String format) throws IOException {
				writeCalls += 1;
				if (writeCalls == 3) {
					throw injected;
				}
				return super.writeBuffered(image, format);
			}
		};
		processor.config = config;

		BufferedImage source = solidImage(800, 600);
		IOException thrown = assertThrows(IOException.class, () -> processor.thumbnailPyramid(source));
		assertEquals(injected, thrown, "Original failure must be propagated unchanged");

		Set<Path> after = listProcessedTempFiles();
		Set<Path> leaked = new HashSet<>(after);
		leaked.removeAll(snapshot);
		assertEquals(Set.of(), leaked,
				"thumbnailPyramid must delete every temp file it created when construction fails: leaked=" + leaked);
	}

	private static Set<Path> listProcessedTempFiles() throws IOException {
		Path tempDir = Paths.get(System.getProperty("java.io.tmpdir"));
		try (Stream<Path> entries = Files.list(tempDir)) {
			Set<Path> files = new HashSet<>();
			entries.filter(p -> p.getFileName().toString().startsWith("pina-processed-")).forEach(files::add);
			return files;
		}
	}

	private static BufferedImage solidImage(int width, int height) {
		BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
		var g = image.createGraphics();
		g.setColor(Color.ORANGE);
		g.fillRect(0, 0, width, height);
		g.dispose();
		return image;
	}
}
