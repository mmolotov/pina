package dev.pina.backend.service;

import dev.pina.backend.domain.AlbumPhoto;
import dev.pina.backend.domain.PersonalLibrary;
import dev.pina.backend.domain.Photo;
import dev.pina.backend.domain.PhotoVariant;
import dev.pina.backend.domain.User;
import dev.pina.backend.domain.VariantType;
import dev.pina.backend.pagination.PageRequest;
import dev.pina.backend.pagination.PageResult;
import dev.pina.backend.storage.StoragePath;
import dev.pina.backend.storage.StorageProvider;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceException;
import jakarta.transaction.Transactional;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.DigestOutputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.hibernate.Hibernate;

@ApplicationScoped
public class PhotoService {

	private static final Logger LOG = Logger.getLogger(PhotoService.class.getName());
	private static final String FAVORITE_TARGET_LOCK_NAMESPACE = "favorite-target-photo";

	@Inject
	StorageProvider storage;

	@Inject
	ImageProcessor imageProcessor;

	@Inject
	ExifExtractor exifExtractor;

	@Inject
	PhotoVariantGenerator variantGenerator;

	@Inject
	PersonalLibraryService personalLibraryService;

	@Inject
	FavoriteService favoriteService;

	@Inject
	EntityManager em;

	@Inject
	TransactionCallbacks transactionCallbacks;

	@Inject
	TransactionalLockService lockService;

	record IngestedFile(Path tempFile, String contentHash, long size) {
	}

	record AnalyzedImage(BufferedImage image, ExifExtractor.ExifResult exif) {
	}

	public enum DeleteResult {
		DELETED, NOT_FOUND, HAS_REFERENCES
	}

	@Transactional
	public Photo upload(InputStream inputStream, String originalFilename, String mimeType, User uploader)
			throws IOException {
		var ingested = ingestToTempFile(inputStream);
		try {
			Optional<Photo> existing = Photo.findByContentHashAndUploaderWithRelations(ingested.contentHash(),
					uploader.id);
			if (existing.isPresent()) {
				return existing.get();
			}

			var analyzed = analyzeImage(ingested.tempFile(), mimeType);
			PersonalLibrary personalLibrary = personalLibraryService.getOrCreate(uploader);
			Photo photo;
			try {
				photo = createPhotoEntity(ingested, analyzed, originalFilename, mimeType, uploader, personalLibrary);
			} catch (PersistenceException _) {
				// Concurrent upload by the same user with the same content_hash — unique
				// constraint caught the race.
				Photo.getEntityManager().clear();
				Photo concurrent = Photo.findByContentHashAndUploaderWithRelations(ingested.contentHash(), uploader.id)
						.orElseThrow(() -> new IllegalStateException("Duplicate hash conflict but photo not found"));
				return concurrent;
			}
			try {
				variantGenerator.generateAll(photo, analyzed.image(), ingested.tempFile(), ingested.contentHash(),
						storagePrefixFor());
			} catch (Exception e) {
				// Variant generation failed — remove the orphaned Photo entity to keep DB
				// clean.
				photo.delete();
				em.flush();
				throw e;
			}
			return photo;
		} finally {
			Files.deleteIfExists(ingested.tempFile());
		}
	}

	public Optional<Photo> findById(UUID id) {
		return Photo.findByIdWithRelations(id);
	}

	@Transactional
	public DeleteResult delete(UUID id) {
		lockService.lock(FAVORITE_TARGET_LOCK_NAMESPACE, id);
		Photo photo = findByIdForDelete(id);
		if (photo == null) {
			return DeleteResult.NOT_FOUND;
		}
		if (AlbumPhoto.find("photo.id", id).count() > 0) {
			return DeleteResult.HAS_REFERENCES;
		}
		List<String> storagePaths = photo.variants.stream().map(variant -> variant.storagePath).toList();
		favoriteService.removeForTarget(dev.pina.backend.domain.FavoriteTargetType.PHOTO, id);
		photo.delete();
		em.flush();
		transactionCallbacks.afterCommit(() -> deleteStoredVariants(storagePaths));
		return DeleteResult.DELETED;
	}

	public InputStream getVariantFile(Photo photo, VariantType variantType) {
		PhotoVariant variant = photo.variants.stream().filter(v -> v.variantType == variantType).findFirst()
				.orElseThrow(() -> new IllegalArgumentException("Variant not found: " + variantType));
		return storage.retrieve(new StoragePath(variant.storagePath));
	}

	private static final int MAX_PAGE_SIZE = 100;

	public List<Photo> listByUploader(UUID uploaderId, int page, int size) {
		return listByUploader(uploaderId, new PageRequest(page, size, false)).items();
	}

	@Transactional
	public PageResult<Photo> listByUploader(UUID uploaderId, PageRequest pageRequest) {
		int effectiveSize = pageRequest.effectiveSize(MAX_PAGE_SIZE);
		List<UUID> photoIdsWithLookahead = em.createQuery(
				"SELECT p.id FROM Photo p WHERE p.uploader.id = :uploaderId ORDER BY p.createdAt DESC, p.id DESC",
				UUID.class).setParameter("uploaderId", uploaderId).setFirstResult(pageRequest.offset(MAX_PAGE_SIZE))
				.setMaxResults(effectiveSize + 1).getResultList();
		boolean hasNext = photoIdsWithLookahead.size() > effectiveSize;
		List<UUID> photoIds = hasNext ? photoIdsWithLookahead.subList(0, effectiveSize) : photoIdsWithLookahead;

		Long totalItems = null;
		Long totalPages = null;
		if (pageRequest.needsTotal()) {
			totalItems = em.createQuery("SELECT COUNT(p) FROM Photo p WHERE p.uploader.id = :uploaderId", Long.class)
					.setParameter("uploaderId", uploaderId).getSingleResult();
			totalPages = PageResult.totalPages(totalItems, effectiveSize);
		}

		if (photoIds.isEmpty()) {
			return new PageResult<>(List.of(), pageRequest.page(), effectiveSize, hasNext, totalItems, totalPages);
		}

		List<Photo> photos = em.createQuery(
				"SELECT DISTINCT p FROM Photo p LEFT JOIN FETCH p.variants LEFT JOIN FETCH p.uploader LEFT JOIN FETCH p.personalLibrary WHERE p.id IN :photoIds",
				Photo.class).setParameter("photoIds", photoIds).getResultList();
		Map<UUID, Photo> photosById = new LinkedHashMap<>();
		for (Photo photo : photos) {
			photosById.put(photo.id, photo);
		}
		if (photosById.size() != photoIds.size()) {
			throw new IllegalStateException("Photos changed during pagination");
		}
		List<Photo> orderedPhotos = photoIds.stream().map(photoId -> {
			Photo photo = photosById.get(photoId);
			if (photo == null) {
				throw new IllegalStateException("Photos changed during pagination");
			}
			return photo;
		}).toList();
		return new PageResult<>(orderedPhotos, pageRequest.page(), effectiveSize, hasNext, totalItems, totalPages);
	}

	private IngestedFile ingestToTempFile(InputStream input) throws IOException {
		Path tempFile = Files.createTempFile("pina-upload-", ".tmp");
		String hash = copyAndHash(input, tempFile);
		long size = Files.size(tempFile);
		return new IngestedFile(tempFile, hash, size);
	}

	private AnalyzedImage analyzeImage(Path tempFile, String mimeType) throws IOException {
		BufferedImage image = imageProcessor.readImage(tempFile);
		if (image == null) {
			throw new IllegalArgumentException("Unsupported image format: " + mimeType);
		}
		ExifExtractor.ExifResult exif = exifExtractor.extract(tempFile);

		return new AnalyzedImage(image, exif);
	}

	private Photo createPhotoEntity(IngestedFile ingested, AnalyzedImage analyzed, String originalFilename,
			String mimeType, User uploader, PersonalLibrary personalLibrary) {
		Photo photo = new Photo();
		photo.uploader = uploader;
		photo.personalLibrary = personalLibrary;
		photo.contentHash = ingested.contentHash();
		photo.originalFilename = originalFilename;
		photo.mimeType = mimeType;
		photo.width = analyzed.image().getWidth();
		photo.height = analyzed.image().getHeight();
		photo.sizeBytes = ingested.size();
		photo.exifData = analyzed.exif().json();
		photo.takenAt = analyzed.exif().takenAt();
		photo.persistAndFlush();
		return photo;
	}

	private String storagePrefixFor() {
		LocalDate now = LocalDate.now();
		return "%d/%02d".formatted(now.getYear(), now.getMonthValue());
	}

	private String copyAndHash(InputStream input, Path target) throws IOException {
		try {
			var digest = MessageDigest.getInstance("SHA-256");
			try (OutputStream out = new DigestOutputStream(Files.newOutputStream(target), digest)) {
				input.transferTo(out);
			}
			return HexFormat.of().formatHex(digest.digest());
		} catch (NoSuchAlgorithmException _) {
			throw new AssertionError("SHA-256 must be available");
		}
	}

	private Photo findByIdForDelete(UUID id) {
		Photo photo = em.find(Photo.class, id, LockModeType.PESSIMISTIC_WRITE);
		if (photo != null) {
			Hibernate.initialize(photo.variants);
		}
		return photo;
	}

	private void deleteStoredVariants(List<String> storagePaths) {
		for (String storagePath : storagePaths) {
			try {
				storage.delete(new StoragePath(storagePath));
			} catch (RuntimeException e) {
				LOG.log(Level.WARNING, "Failed to delete stored variant after transaction commit: " + storagePath, e);
			}
		}
	}
}
