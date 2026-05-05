package dev.pina.backend.service;

import dev.pina.backend.config.PhotoConfig;
import io.quarkus.runtime.Startup;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import javax.imageio.ImageIO;
import net.coobird.thumbnailator.Thumbnails;

@ApplicationScoped
@Startup
public class ImageProcessor {

	private static final Set<String> SUPPORTED_FORMATS = Set.of("jpeg", "jpg", "png");
	private static final double THUMBNAIL_QUALITY = 0.8;

	@Inject
	PhotoConfig config;

	public record ThumbnailPyramid(ProcessedImage lg, ProcessedImage md, ProcessedImage sm, ProcessedImage xs) {
	}

	void validate(@Observes StartupEvent event) {
		String format = config.compression().format();
		if (!SUPPORTED_FORMATS.contains(format)) {
			throw new IllegalStateException(
					"Unsupported compression format '%s'. Supported: %s".formatted(format, SUPPORTED_FORMATS));
		}
	}

	public BufferedImage readImage(InputStream input) throws IOException {
		return ImageIO.read(input);
	}

	public BufferedImage readImage(Path source) throws IOException {
		return ImageIO.read(source.toFile());
	}

	public ProcessedImage compress(BufferedImage source) throws IOException {
		int maxRes = config.compression().maxResolution();
		String format = outputFormat();

		double scale = computeScale(source.getWidth(), source.getHeight(), maxRes);
		int targetW = (int) (source.getWidth() * scale);
		int targetH = (int) (source.getHeight() * scale);

		Path tempFile = createTempFile(format);
		try {
			try (OutputStream out = Files.newOutputStream(tempFile)) {
				Thumbnails.of(source).size(targetW, targetH).outputFormat(format)
						.outputQuality((double) config.compression().quality() / 100).toOutputStream(out);
			}
			return new ProcessedImage(tempFile, targetW, targetH, format, Files.size(tempFile));
		} catch (IOException | RuntimeException e) {
			deleteQuietly(tempFile, e);
			throw e;
		}
	}

	public ThumbnailPyramid thumbnailPyramid(BufferedImage source) throws IOException {
		String format = outputFormat();
		List<ProcessedImage> built = new ArrayList<>(4);
		try {
			BufferedImage lg = Thumbnails.of(source).size(config.thumbnails().lgWidth(), config.thumbnails().lgWidth())
					.asBufferedImage();
			ProcessedImage lgImage = writeBuffered(lg, format);
			built.add(lgImage);

			BufferedImage md = Thumbnails.of(lg).size(config.thumbnails().mdWidth(), config.thumbnails().mdWidth())
					.asBufferedImage();
			ProcessedImage mdImage = writeBuffered(md, format);
			built.add(mdImage);

			BufferedImage lgSquare = centerCropSquare(lg);
			int smSize = config.thumbnails().smSize();
			BufferedImage sm = Thumbnails.of(lgSquare).forceSize(smSize, smSize).asBufferedImage();
			ProcessedImage smImage = writeBuffered(sm, format);
			built.add(smImage);

			int xsSize = config.thumbnails().xsSize();
			BufferedImage xs = Thumbnails.of(sm).forceSize(xsSize, xsSize).asBufferedImage();
			ProcessedImage xsImage = writeBuffered(xs, format);
			built.add(xsImage);

			return new ThumbnailPyramid(lgImage, mdImage, smImage, xsImage);
		} catch (IOException | RuntimeException e) {
			// Mid-pyramid failure: close every successfully-built ProcessedImage so
			// its temp file is removed. The caller never received the pyramid record
			// and therefore would have no way to close them itself.
			for (ProcessedImage built_ : built) {
				try {
					built_.close();
				} catch (RuntimeException closeEx) {
					e.addSuppressed(closeEx);
				}
			}
			throw e;
		}
	}

	ProcessedImage writeBuffered(BufferedImage image, String format) throws IOException {
		Path tempFile = createTempFile(format);
		try {
			try (OutputStream out = Files.newOutputStream(tempFile)) {
				Thumbnails.of(image).scale(1.0).outputFormat(format).outputQuality(THUMBNAIL_QUALITY)
						.toOutputStream(out);
			}
			return new ProcessedImage(tempFile, image.getWidth(), image.getHeight(), format, Files.size(tempFile));
		} catch (IOException | RuntimeException e) {
			deleteQuietly(tempFile, e);
			throw e;
		}
	}

	private static void deleteQuietly(Path tempFile, Throwable cause) {
		try {
			Files.deleteIfExists(tempFile);
		} catch (IOException deleteEx) {
			cause.addSuppressed(deleteEx);
		}
	}

	private String outputFormat() {
		return config.compression().format();
	}

	private BufferedImage centerCropSquare(BufferedImage source) {
		int side = Math.min(source.getWidth(), source.getHeight());
		int x = (source.getWidth() - side) / 2;
		int y = (source.getHeight() - side) / 2;
		return source.getSubimage(x, y, side, side);
	}

	private double computeScale(int sourceW, int sourceH, int maxDimension) {
		int longestSide = Math.max(sourceW, sourceH);
		if (longestSide <= maxDimension) {
			return 1.0;
		}
		return (double) maxDimension / longestSide;
	}

	private Path createTempFile(String format) throws IOException {
		return Files.createTempFile("pina-processed-", "." + format);
	}
}
