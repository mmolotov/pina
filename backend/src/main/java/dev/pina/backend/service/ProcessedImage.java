package dev.pina.backend.service;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;

public record ProcessedImage(Path tempFile, int width, int height, String format,
		long sizeBytes) implements AutoCloseable {

	public InputStream openStream() throws IOException {
		return Files.newInputStream(tempFile);
	}

	@Override
	public void close() {
		try {
			Files.deleteIfExists(tempFile);
		} catch (IOException e) {
			throw new UncheckedIOException("Failed to delete processed image temp file: " + tempFile, e);
		}
	}
}
