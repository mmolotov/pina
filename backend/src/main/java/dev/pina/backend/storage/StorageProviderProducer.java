package dev.pina.backend.storage;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class StorageProviderProducer {

	@ConfigProperty(name = "pina.storage.provider", defaultValue = "local")
	String providerType;

	@Inject
	LocalStorageProvider local;

	@Inject
	S3StorageProvider s3;

	@Inject
	WebDavStorageProvider webdav;

	@Produces
	@ApplicationScoped
	public StorageProvider activeProvider() {
		return switch (providerType) {
			case "local" -> local;
			case "s3" -> s3;
			case "webdav" -> webdav;
			default -> throw new IllegalStateException("Unknown storage provider: " + providerType);
		};
	}
}
