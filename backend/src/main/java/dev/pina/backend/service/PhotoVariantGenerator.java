package dev.pina.backend.service;

import dev.pina.backend.config.PhotoConfig;
import dev.pina.backend.domain.Photo;
import dev.pina.backend.domain.PhotoVariant;
import dev.pina.backend.domain.VariantType;
import dev.pina.backend.storage.StoragePath;
import dev.pina.backend.storage.StorageProvider;
import dev.pina.backend.storage.StoreMeta;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.awt.image.BufferedImage;
import java.io.BufferedInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.logging.Level;
import java.util.logging.Logger;

@ApplicationScoped
public class PhotoVariantGenerator {

	private static final Logger LOG = Logger.getLogger(PhotoVariantGenerator.class.getName());

	@Inject
	StorageProvider storage;

	@Inject
	ImageProcessor imageProcessor;

	@Inject
	PhotoConfig photoConfig;

	// Note: each ProcessedImage holds a byte[] in memory. With concurrent uploads
	// of large photos,
	// this can create memory pressure. If this becomes an issue, consider writing
	// variants to temp
	// files instead of holding byte arrays, or limiting upload concurrency.
	public void generateAll(Photo photo, BufferedImage image, Path tempFile, String contentHash, String prefix)
			throws IOException {
		try {
			if (photoConfig.storeOriginal()) {
				storeOriginal(photo, tempFile, contentHash, prefix);
			}
			storeCompressed(photo, image, contentHash, prefix);
			storeThumbnail(photo, VariantType.THUMB_SM, imageProcessor.thumbnailSm(image), contentHash, prefix);
			storeThumbnail(photo, VariantType.THUMB_MD, imageProcessor.thumbnailMd(image), contentHash, prefix);
			storeThumbnail(photo, VariantType.THUMB_LG, imageProcessor.thumbnailLg(image), contentHash, prefix);
		} catch (Exception e) {
			cleanupStoredVariants(photo);
			throw e;
		}
	}

	private void cleanupStoredVariants(Photo photo) {
		for (PhotoVariant variant : photo.variants) {
			try {
				storage.delete(new StoragePath(variant.storagePath));
			} catch (Exception e) {
				LOG.log(Level.WARNING, "Failed to cleanup variant: " + variant.storagePath, e);
			}
		}
	}

	private void storeOriginal(Photo photo, Path tempFile, String contentHash, String prefix) throws IOException {
		String ext = MimeTypes.extensionFrom(photo.mimeType);
		long fileSize = Files.size(tempFile);
		StoragePath path = storagePath(VariantType.ORIGINAL, prefix, contentHash, ext);
		try (var in = new BufferedInputStream(Files.newInputStream(tempFile))) {
			storage.store(path, in, new StoreMeta(photo.mimeType, fileSize, contentHash));
		}
		addVariant(photo, VariantType.ORIGINAL, path, ext, null, photo.width, photo.height, fileSize);
	}

	private void storeCompressed(Photo photo, BufferedImage image, String contentHash, String prefix)
			throws IOException {
		var compressed = imageProcessor.compress(image);
		StoragePath path = storagePath(VariantType.COMPRESSED, prefix, contentHash, compressed.format());
		storage.store(path, new ByteArrayInputStream(compressed.data()),
				new StoreMeta(MimeTypes.mimeForFormat(compressed.format()), compressed.sizeBytes(), null));
		addVariant(photo, VariantType.COMPRESSED, path, compressed.format(), photoConfig.compression().quality(),
				compressed.width(), compressed.height(), compressed.sizeBytes());
	}

	private void storeThumbnail(Photo photo, VariantType type, ProcessedImage processed, String hash, String prefix) {
		StoragePath path = storagePath(type, prefix, hash, processed.format());
		storage.store(path, new ByteArrayInputStream(processed.data()),
				new StoreMeta(MimeTypes.mimeForFormat(processed.format()), processed.sizeBytes(), null));
		addVariant(photo, type, path, processed.format(), null, processed.width(), processed.height(),
				processed.sizeBytes());
	}

	private StoragePath storagePath(VariantType type, String prefix, String hash, String ext) {
		return StoragePath.of(type.storageFolder(), prefix, hash + "." + ext);
	}

	private void addVariant(Photo photo, VariantType type, StoragePath path, String format, Integer quality, int width,
			int height, long sizeBytes) {
		PhotoVariant variant = new PhotoVariant();
		variant.photo = photo;
		variant.variantType = type;
		variant.storagePath = path.path();
		variant.format = format;
		variant.quality = quality;
		variant.width = width;
		variant.height = height;
		variant.sizeBytes = sizeBytes;
		variant.persist();
		photo.variants.add(variant);
	}
}
