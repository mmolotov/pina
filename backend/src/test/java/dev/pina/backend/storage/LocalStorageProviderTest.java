package dev.pina.backend.storage;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LocalStorageProviderTest {

	@TempDir
	Path tempDir;

	LocalStorageProvider provider;

	@BeforeEach
	void setup() {
		provider = new LocalStorageProvider();
		provider.basePath = tempDir.toString();
	}

	@Test
	void storeAndRetrieve() throws IOException {
		byte[] content = "hello world".getBytes(StandardCharsets.UTF_8);
		StoragePath path = StoragePath.of("test", "file.txt");
		StoreMeta meta = new StoreMeta("text/plain", content.length, null);

		provider.store(path, new ByteArrayInputStream(content), meta);

		assertTrue(provider.exists(path));

		try (InputStream retrieved = provider.retrieve(path)) {
			assertArrayEquals(content, retrieved.readAllBytes());
		}
	}

	@Test
	void delete() {
		byte[] content = "data".getBytes(StandardCharsets.UTF_8);
		StoragePath path = StoragePath.of("test", "delete-me.txt");
		provider.store(path, new ByteArrayInputStream(content), new StoreMeta("text/plain", 4, null));

		assertTrue(provider.exists(path));
		provider.delete(path);
		assertFalse(provider.exists(path));
	}

	@Test
	void stats() {
		StorageStats stats = provider.stats();
		assertTrue(stats.availableBytes() > 0);
	}

	@Test
	void createsParentDirectories() {
		StoragePath path = StoragePath.of("deep", "nested", "dir", "file.txt");
		byte[] content = "nested".getBytes(StandardCharsets.UTF_8);
		provider.store(path, new ByteArrayInputStream(content), new StoreMeta("text/plain", content.length, null));

		assertTrue(provider.exists(path));
		assertTrue(Files.exists(tempDir.resolve("deep/nested/dir/file.txt")));
	}
}
