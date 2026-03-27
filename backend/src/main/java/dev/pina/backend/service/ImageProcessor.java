package dev.pina.backend.service;

import dev.pina.backend.config.PhotoConfig;
import io.quarkus.runtime.Startup;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Set;
import javax.imageio.ImageIO;
import net.coobird.thumbnailator.Thumbnails;

@ApplicationScoped
@Startup
public class ImageProcessor {

	private static final Set<String> SUPPORTED_FORMATS = Set.of("jpeg", "jpg", "png");

	@Inject
	PhotoConfig config;

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

	public ProcessedImage compress(BufferedImage source) throws IOException {
		int maxRes = config.compression().maxResolution();
		String format = outputFormat();

		double scale = computeScale(source.getWidth(), source.getHeight(), maxRes);
		int targetW = (int) (source.getWidth() * scale);
		int targetH = (int) (source.getHeight() * scale);

		var baos = new ByteArrayOutputStream();
		Thumbnails.of(source).size(targetW, targetH).outputFormat(format)
				.outputQuality((double) config.compression().quality() / 100).toOutputStream(baos);

		return new ProcessedImage(baos.toByteArray(), targetW, targetH, format, baos.size());
	}

	public ProcessedImage thumbnailSm(BufferedImage source) throws IOException {
		int targetSize = config.thumbnails().smSize();
		BufferedImage square = centerCropSquare(source);
		String format = outputFormat();
		var baos = new ByteArrayOutputStream();
		Thumbnails.of(square).forceSize(targetSize, targetSize).outputFormat(format).outputQuality(0.8)
				.toOutputStream(baos);
		return new ProcessedImage(baos.toByteArray(), targetSize, targetSize, format, baos.size());
	}

	public ProcessedImage thumbnailMd(BufferedImage source) throws IOException {
		int targetW = config.thumbnails().mdWidth();
		double scale = computeScale(source.getWidth(), source.getHeight(), targetW);
		int targetH = (int) (source.getHeight() * scale);
		return thumbnail(source, targetW, targetH);
	}

	public ProcessedImage thumbnailLg(BufferedImage source) throws IOException {
		int targetW = config.thumbnails().lgWidth();
		double scale = computeScale(source.getWidth(), source.getHeight(), targetW);
		int targetH = (int) (source.getHeight() * scale);
		return thumbnail(source, targetW, targetH);
	}

	private ProcessedImage thumbnail(BufferedImage source, int maxW, int maxH) throws IOException {
		String format = outputFormat();
		var baos = new ByteArrayOutputStream();
		Thumbnails.of(source).size(maxW, maxH).outputFormat(format).outputQuality(0.8).toOutputStream(baos);

		// Read back actual dimensions
		var thumb = ImageIO.read(new ByteArrayInputStream(baos.toByteArray()));
		if (thumb == null) {
			throw new IOException("Failed to read back generated thumbnail");
		}
		return new ProcessedImage(baos.toByteArray(), thumb.getWidth(), thumb.getHeight(), format, baos.size());
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
}
