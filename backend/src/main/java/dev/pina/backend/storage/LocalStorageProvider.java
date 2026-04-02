package dev.pina.backend.storage;

import io.quarkus.arc.Unremovable;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
@Typed(LocalStorageProvider.class)
@Unremovable
public class LocalStorageProvider implements StorageProvider {

	@ConfigProperty(name = "pina.storage.local.base-path", defaultValue = "data")
	String basePath;

	@Override
	public String type() {
		return "local";
	}

	@Override
	public void store(StoragePath path, InputStream data, StoreMeta meta) {
		try {
			Path target = resolve(path);
			Files.createDirectories(target.getParent());
			Files.copy(data, target, StandardCopyOption.REPLACE_EXISTING);
		} catch (IOException e) {
			throw new UncheckedIOException("Failed to store file: " + path.path(), e);
		}
	}

	@Override
	public void store(StoragePath path, Path source, StoreMeta meta) {
		try {
			Path target = resolve(path);
			Files.createDirectories(target.getParent());
			try {
				Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
			} catch (IOException moveError) {
				Files.copy(source, target, StandardCopyOption.REPLACE_EXISTING);
			}
		} catch (IOException e) {
			throw new UncheckedIOException("Failed to store file: " + path.path(), e);
		}
	}

	@Override
	public InputStream retrieve(StoragePath path) {
		try {
			return Files.newInputStream(resolve(path));
		} catch (IOException e) {
			throw new UncheckedIOException("Failed to retrieve file: " + path.path(), e);
		}
	}

	@Override
	public void delete(StoragePath path) {
		try {
			Files.deleteIfExists(resolve(path));
		} catch (IOException e) {
			throw new UncheckedIOException("Failed to delete file: " + path.path(), e);
		}
	}

	@Override
	public boolean exists(StoragePath path) {
		return Files.exists(resolve(path));
	}

	@Override
	public StorageStats stats() {
		try {
			Path root = Path.of(basePath);
			Files.createDirectories(root);
			var store = Files.getFileStore(root);
			long usable = store.getUsableSpace();
			long total = store.getTotalSpace();
			return new StorageStats(total - usable, usable);
		} catch (IOException e) {
			throw new UncheckedIOException("Failed to get storage stats", e);
		}
	}

	private Path resolve(StoragePath path) {
		return Path.of(basePath).resolve(path.path());
	}
}
