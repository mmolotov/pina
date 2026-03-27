package dev.pina.backend.storage;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

@QuarkusTest
class StorageProviderProducerTest {

	@Test
	void activeProviderReturnsConfiguredImplementation() {
		StorageProviderProducer producer = new StorageProviderProducer();
		producer.local = new LocalStorageProvider();
		producer.s3 = new S3StorageProvider();
		producer.webdav = new WebDavStorageProvider();

		producer.providerType = "local";
		assertSame(producer.local, producer.activeProvider());

		producer.providerType = "s3";
		assertSame(producer.s3, producer.activeProvider());

		producer.providerType = "webdav";
		assertSame(producer.webdav, producer.activeProvider());
	}

	@Test
	void activeProviderRejectsUnknownType() {
		StorageProviderProducer producer = new StorageProviderProducer();
		producer.local = new LocalStorageProvider();
		producer.s3 = new S3StorageProvider();
		producer.webdav = new WebDavStorageProvider();
		producer.providerType = "mystery";

		assertThrows(IllegalStateException.class, producer::activeProvider);
	}
}
