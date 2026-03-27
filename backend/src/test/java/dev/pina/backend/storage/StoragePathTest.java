package dev.pina.backend.storage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

@QuarkusTest
class StoragePathTest {

	@Test
	void constructorRejectsBlankAndEscapingPaths() {
		assertThrows(IllegalArgumentException.class, () -> new StoragePath(" "));
		assertThrows(IllegalArgumentException.class, () -> new StoragePath("../escape"));
		assertThrows(IllegalArgumentException.class, () -> new StoragePath("/absolute"));
	}

	@Test
	void resolveNormalizesNestedPath() {
		StoragePath base = new StoragePath("photos/2026");

		assertEquals("photos/2026/album/image.jpg", base.resolve("album/./image.jpg").path());
	}
}
