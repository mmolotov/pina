package dev.pina.backend.storage;

import io.quarkus.arc.Unremovable;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import java.io.InputStream;

@ApplicationScoped
@Typed(WebDavStorageProvider.class)
@Unremovable
public class WebDavStorageProvider implements StorageProvider {

	@Override
	public String type() {
		return "webdav";
	}

	@Override
	public void store(StoragePath path, InputStream data, StoreMeta meta) {
		throw new UnsupportedOperationException("WebDAV storage not yet implemented");
	}

	@Override
	public InputStream retrieve(StoragePath path) {
		throw new UnsupportedOperationException("WebDAV storage not yet implemented");
	}

	@Override
	public void delete(StoragePath path) {
		throw new UnsupportedOperationException("WebDAV storage not yet implemented");
	}

	@Override
	public boolean exists(StoragePath path) {
		throw new UnsupportedOperationException("WebDAV storage not yet implemented");
	}

	@Override
	public StorageStats stats() {
		throw new UnsupportedOperationException("WebDAV storage not yet implemented");
	}
}
