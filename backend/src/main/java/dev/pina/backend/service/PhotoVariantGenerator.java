package dev.pina.backend.service;

import dev.pina.backend.config.PhotoConfig;
import dev.pina.backend.domain.Photo;
import dev.pina.backend.domain.VariantType;
import dev.pina.backend.storage.StoragePath;
import dev.pina.backend.storage.StorageProvider;
import dev.pina.backend.storage.StoreMeta;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
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

	@Inject
	PhotoVariantExecutor variantExecutor;

	public record VariantSpec(VariantType type, StoragePath path, String format, Integer quality, int width, int height,
			long sizeBytes) {
	}

	public List<VariantSpec> storeAll(Photo photo, BufferedImage image, Path tempFile, String contentHash,
			String prefix) throws IOException {
		List<Callable<List<VariantSpec>>> tasks = new ArrayList<>();
		if (photoConfig.storeOriginal()) {
			tasks.add(() -> List.of(buildOriginalSpec(photo, tempFile, contentHash, prefix)));
		}
		tasks.add(() -> List.of(buildCompressedSpec(photo, image, prefix)));
		tasks.add(() -> buildThumbnailPyramidSpecs(photo, image, prefix));

		return runInParallel(tasks);
	}

	private List<VariantSpec> runInParallel(List<Callable<List<VariantSpec>>> tasks) throws IOException {
		ExecutorService executor = variantExecutor.executor();
		List<CompletableFuture<List<VariantSpec>>> futures = new ArrayList<>(tasks.size());
		for (Callable<List<VariantSpec>> task : tasks) {
			futures.add(CompletableFuture.supplyAsync(() -> {
				try {
					return task.call();
				} catch (RuntimeException e) {
					throw e;
				} catch (Exception e) {
					throw new CompletionException(e);
				}
			}, executor));
		}

		try {
			CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new)).join();
		} catch (CompletionException e) {
			cleanupCompleted(futures);
			Throwable cause = e.getCause() != null ? e.getCause() : e;
			if (cause instanceof IOException ioe) {
				throw ioe;
			}
			if (cause instanceof RuntimeException re) {
				throw re;
			}
			throw new IOException("Variant generation failed", cause);
		}

		List<VariantSpec> specs = new ArrayList<>();
		for (CompletableFuture<List<VariantSpec>> future : futures) {
			specs.addAll(future.join());
		}
		return specs;
	}

	private void cleanupCompleted(List<CompletableFuture<List<VariantSpec>>> futures) {
		for (CompletableFuture<List<VariantSpec>> future : futures) {
			if (future.isDone() && !future.isCompletedExceptionally()) {
				for (VariantSpec spec : future.join()) {
					try {
						storage.delete(spec.path());
					} catch (RuntimeException ex) {
						LOG.log(Level.WARNING,
								"Failed to clean up variant after sibling failure: " + spec.path().path(), ex);
					}
				}
			}
		}
	}

	private VariantSpec buildOriginalSpec(Photo photo, Path tempFile, String contentHash, String prefix)
			throws IOException {
		String ext = MimeTypes.extensionFrom(photo.mimeType);
		long fileSize = Files.size(tempFile);
		StoragePath path = storagePath(photo, VariantType.ORIGINAL, prefix, ext);
		storage.store(path, tempFile, new StoreMeta(photo.mimeType, fileSize, contentHash));
		return new VariantSpec(VariantType.ORIGINAL, path, ext, null, photo.width, photo.height, fileSize);
	}

	private VariantSpec buildCompressedSpec(Photo photo, BufferedImage image, String prefix) throws IOException {
		try (ProcessedImage compressed = imageProcessor.compress(image); InputStream stream = compressed.openStream()) {
			StoragePath path = storagePath(photo, VariantType.COMPRESSED, prefix, compressed.format());
			storage.store(path, stream,
					new StoreMeta(MimeTypes.mimeForFormat(compressed.format()), compressed.sizeBytes(), null));
			return new VariantSpec(VariantType.COMPRESSED, path, compressed.format(),
					photoConfig.compression().quality(), compressed.width(), compressed.height(),
					compressed.sizeBytes());
		}
	}

	private List<VariantSpec> buildThumbnailPyramidSpecs(Photo photo, BufferedImage image, String prefix)
			throws IOException {
		ImageProcessor.ThumbnailPyramid pyramid = imageProcessor.thumbnailPyramid(image);
		List<VariantSpec> specs = new ArrayList<>(4);
		try (ProcessedImage lg = pyramid.lg();
				ProcessedImage md = pyramid.md();
				ProcessedImage sm = pyramid.sm();
				ProcessedImage xs = pyramid.xs()) {
			// Order matches previous insertion order: XS, SM, MD, LG.
			specs.add(storeProcessed(photo, VariantType.THUMB_XS, xs, prefix));
			specs.add(storeProcessed(photo, VariantType.THUMB_SM, sm, prefix));
			specs.add(storeProcessed(photo, VariantType.THUMB_MD, md, prefix));
			specs.add(storeProcessed(photo, VariantType.THUMB_LG, lg, prefix));
			return specs;
		} catch (IOException | RuntimeException e) {
			// One of the thumbnail stores failed midway through the chain: delete any
			// thumbnails already written so we don't leak orphaned files to storage.
			for (VariantSpec stored : specs) {
				try {
					storage.delete(stored.path());
				} catch (RuntimeException ignored) {
					LOG.log(Level.WARNING,
							"Failed to clean up partial thumbnail after pyramid failure: " + stored.path().path(),
							ignored);
				}
			}
			throw e;
		}
	}

	private VariantSpec storeProcessed(Photo photo, VariantType type, ProcessedImage processed, String prefix)
			throws IOException {
		try (InputStream stream = processed.openStream()) {
			StoragePath path = storagePath(photo, type, prefix, processed.format());
			storage.store(path, stream,
					new StoreMeta(MimeTypes.mimeForFormat(processed.format()), processed.sizeBytes(), null));
			return new VariantSpec(type, path, processed.format(), null, processed.width(), processed.height(),
					processed.sizeBytes());
		}
	}

	public void deleteStoredFiles(List<VariantSpec> specs) {
		for (VariantSpec spec : specs) {
			try {
				storage.delete(spec.path());
			} catch (RuntimeException ex) {
				LOG.log(Level.WARNING, "Failed to delete stored variant: " + spec.path().path(), ex);
			}
		}
	}

	private StoragePath storagePath(Photo photo, VariantType type, String prefix, String ext) {
		return StoragePath.of(type.storageFolder(), prefix, fileKey(photo) + "." + ext);
	}

	private String fileKey(Photo photo) {
		if (photo.id == null) {
			throw new IllegalArgumentException("photo.id must be assigned before storing variants");
		}
		return photo.id.toString();
	}
}
