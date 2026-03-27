package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

@QuarkusTest
class MimeTypesTest {

	@Test
	void supportedImageCheckHandlesKnownUnknownAndNullTypes() {
		assertTrue(MimeTypes.isSupportedImage("image/jpeg"));
		assertTrue(MimeTypes.isSupportedImage("image/png"));
		assertFalse(MimeTypes.isSupportedImage("image/webp"));
		assertFalse(MimeTypes.isSupportedImage(null));
	}

	@Test
	void extensionFromHandlesKnownAndFallbackTypes() {
		assertEquals("jpg", MimeTypes.extensionFrom("image/jpeg"));
		assertEquals("png", MimeTypes.extensionFrom("image/png"));
		assertEquals("bin", MimeTypes.extensionFrom("application/octet-stream"));
	}

	@Test
	void mimeForFormatHandlesKnownAndFallbackFormats() {
		assertEquals("image/jpeg", MimeTypes.mimeForFormat("jpg"));
		assertEquals("image/jpeg", MimeTypes.mimeForFormat("jpeg"));
		assertEquals("image/png", MimeTypes.mimeForFormat("png"));
		assertEquals("image/webp", MimeTypes.mimeForFormat("webp"));
	}
}
