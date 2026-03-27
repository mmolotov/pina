package dev.pina.backend.storage;

import java.io.InputStream;

public interface StorageProvider {

	String type();

	void store(StoragePath path, InputStream data, StoreMeta meta);

	InputStream retrieve(StoragePath path);

	void delete(StoragePath path);

	boolean exists(StoragePath path);

	StorageStats stats();
}
