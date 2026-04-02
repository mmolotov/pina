package dev.pina.backend.storage;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;

public interface StorageProvider {

	String type();

	void store(StoragePath path, InputStream data, StoreMeta meta);

	default void store(StoragePath path, Path source, StoreMeta meta) {
		try (InputStream data = Files.newInputStream(source)) {
			store(path, data, meta);
		} catch (IOException e) {
			throw new UncheckedIOException("Failed to store file: " + path.path(), e);
		}
	}

	InputStream retrieve(StoragePath path);

	void delete(StoragePath path);

	boolean exists(StoragePath path);

	StorageStats stats();
}
