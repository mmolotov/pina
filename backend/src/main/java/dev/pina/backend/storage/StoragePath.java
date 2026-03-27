package dev.pina.backend.storage;

import java.nio.file.Path;
import java.util.Objects;

public record StoragePath(String path) {

	public StoragePath {
		Objects.requireNonNull(path, "path must not be null");
		if (path.isBlank()) {
			throw new IllegalArgumentException("path must not be blank");
		}
		// Normalize and enforce forward slashes (Path.normalize uses OS separator on
		// Windows)
		var normalized = Path.of(path).normalize().toString().replace('\\', '/');
		if (normalized.startsWith("..") || normalized.startsWith("/")) {
			throw new IllegalArgumentException("path must not escape base directory: " + path);
		}
		path = normalized;
	}

	public StoragePath resolve(String child) {
		return new StoragePath(Path.of(path, child).normalize().toString().replace('\\', '/'));
	}

	public static StoragePath of(String... segments) {
		return new StoragePath(String.join("/", segments));
	}
}
