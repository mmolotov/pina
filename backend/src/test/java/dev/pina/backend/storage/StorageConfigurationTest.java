package dev.pina.backend.storage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.io.IOException;
import java.util.Properties;
import org.junit.jupiter.api.Test;

class StorageConfigurationTest {

	@Test
	void testResourcesUseDedicatedStorageDirectory() throws IOException {
		Properties properties = new Properties();
		try (var input = getClass().getClassLoader().getResourceAsStream("application.properties")) {
			assertNotNull(input);
			properties.load(input);
		}

		String localStorageBasePath = properties.getProperty("pina.storage.local.base-path");
		assertEquals("build/test-data", localStorageBasePath);
		assertNotEquals("data", localStorageBasePath);
	}
}
