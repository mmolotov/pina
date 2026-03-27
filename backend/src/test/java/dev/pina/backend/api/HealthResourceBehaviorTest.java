package dev.pina.backend.api;

import static org.junit.jupiter.api.Assertions.assertEquals;

import dev.pina.backend.storage.StoragePath;
import dev.pina.backend.storage.StorageProvider;
import dev.pina.backend.storage.StorageStats;
import dev.pina.backend.storage.StoreMeta;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.ws.rs.core.Response;
import java.io.InputStream;
import java.util.Map;
import org.junit.jupiter.api.Test;

@QuarkusTest
class HealthResourceBehaviorTest {

	@Test
	void healthReturnsServiceUnavailableWhenStorageStatsFail() {
		HealthResource resource = new HealthResource();
		resource.storage = new StorageProvider() {
			@Override
			public String type() {
				return "failing";
			}

			@Override
			public void store(StoragePath path, InputStream data, StoreMeta meta) {
				throw new UnsupportedOperationException();
			}

			@Override
			public InputStream retrieve(StoragePath path) {
				throw new UnsupportedOperationException();
			}

			@Override
			public void delete(StoragePath path) {
				throw new UnsupportedOperationException();
			}

			@Override
			public boolean exists(StoragePath path) {
				throw new UnsupportedOperationException();
			}

			@Override
			public StorageStats stats() {
				throw new IllegalStateException("disk unavailable");
			}
		};

		Response response = resource.health();

		@SuppressWarnings("unchecked")
		Map<String, Object> body = (Map<String, Object>) response.getEntity();
		@SuppressWarnings("unchecked")
		Map<String, Object> storage = (Map<String, Object>) body.get("storage");

		assertEquals(503, response.getStatus());
		assertEquals("down", body.get("status"));
		assertEquals("failing", storage.get("type"));
		assertEquals("unavailable", storage.get("error"));
	}
}
