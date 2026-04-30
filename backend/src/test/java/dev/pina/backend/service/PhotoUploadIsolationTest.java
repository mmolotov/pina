package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import dev.pina.backend.TestUserHelper;
import dev.pina.backend.domain.Photo;
import dev.pina.backend.domain.User;
import dev.pina.backend.storage.StoragePath;
import dev.pina.backend.storage.StorageProvider;
import dev.pina.backend.storage.StoreMeta;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.transaction.Status;
import jakarta.transaction.TransactionManager;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

/**
 * Tests that intentionally do NOT use {@code @Transactional} so the production
 * upload path is exercised end-to-end: each
 * {@code QuarkusTransaction.requiringNew()} inside {@code PhotoService.upload}
 * actually opens a fresh JTA transaction around just its own work, leaving
 * phase 1 (variant storage) without any active transaction.
 */
@QuarkusTest
class PhotoUploadIsolationTest {

	@Inject
	PhotoService photoService;

	@Inject
	TransactionManager transactionManager;

	@InjectMock
	StorageProvider storage;

	@Test
	void variantStorageRunsOutsideAnyDatabaseTransaction() throws IOException {
		AtomicInteger statusDuringStore = new AtomicInteger(-1);
		doAnswer(invocation -> {
			statusDuringStore.set(transactionManager.getStatus());
			return null;
		}).when(storage).store(any(StoragePath.class), any(InputStream.class), any(StoreMeta.class));
		doAnswer(invocation -> {
			statusDuringStore.set(transactionManager.getStatus());
			return null;
		}).when(storage).store(any(StoragePath.class), any(Path.class), any(StoreMeta.class));

		User user = TestUserHelper.createUser("tx-isolation");
		photoService.upload(jpegStream(Color.GREEN), "isolation.jpg", "image/jpeg", user);

		assertEquals(Status.STATUS_NO_TRANSACTION, statusDuringStore.get(),
				"Expected no active JTA transaction during storage.store, but got status " + statusDuringStore.get());
	}

	@Test
	void duplicateLookupDuringStorageDoesNotObserveHalfBuiltPhoto() throws Exception {
		// Phase 1 is held inside a CountDownLatch. While storage writes are still
		// in flight, a concurrent duplicate-upload simulator runs the same dedup
		// query the production code uses. The new design persists the Photo row
		// only after every storage write succeeds, so the dedup query must observe
		// no row during phase 1.
		CountDownLatch storageBlock = new CountDownLatch(1);
		CountDownLatch storageEntered = new CountDownLatch(1);
		doAnswer(invocation -> {
			storageEntered.countDown();
			storageBlock.await();
			return null;
		}).when(storage).store(any(StoragePath.class), any(InputStream.class), any(StoreMeta.class));
		doAnswer(invocation -> {
			storageEntered.countDown();
			storageBlock.await();
			return null;
		}).when(storage).store(any(StoragePath.class), any(Path.class), any(StoreMeta.class));

		User user = TestUserHelper.createUser("half-built");

		CompletableFuture<dev.pina.backend.domain.Photo> uploadFuture = CompletableFuture.supplyAsync(() -> {
			try {
				return photoService.upload(jpegStream(Color.BLUE), "half-built.jpg", "image/jpeg", user);
			} catch (IOException e) {
				throw new RuntimeException(e);
			}
		});

		assertTrue(storageEntered.await(10, TimeUnit.SECONDS), "phase 1 storage write never started");

		// Mid-phase-1 dedup snapshot — must be empty until the persist tx completes.
		Optional<Photo> midFlight = QuarkusTransaction.requiringNew()
				.call(() -> Photo.<Photo>find("uploader.id", user.id).firstResultOptional());
		assertTrue(midFlight.isEmpty(),
				"Concurrent dedup reader must not observe a half-built Photo row during phase 1");

		// Release phase 1 and let the upload commit.
		storageBlock.countDown();
		dev.pina.backend.domain.Photo finished = uploadFuture.get(10, TimeUnit.SECONDS);
		assertTrue(finished != null && finished.id != null, "upload must finish with a persisted photo");
		assertEquals(6, finished.variants.size(), "completed upload must have all six variants attached");

		Optional<Photo> postCommit = QuarkusTransaction.requiringNew()
				.call(() -> Photo.findByIdWithRelations(finished.id));
		assertTrue(postCommit.isPresent(), "Photo must be visible after upload commits");
		assertEquals(6, postCommit.get().variants.size(), "Photo must expose all six variants once visible");
	}

	@Test
	void phaseOneFailureRemovesOrphanPhotoRow() throws IOException {
		// Mocked storage that fails on a single variant — the upload must roll back
		// the orphan Photo row in its own short transaction.
		doAnswer(invocation -> null).when(storage).store(any(StoragePath.class), any(InputStream.class),
				any(StoreMeta.class));
		doAnswer(invocation -> null).when(storage).store(any(StoragePath.class), any(Path.class), any(StoreMeta.class));
		doThrow(new RuntimeException("simulated phase-1 failure")).when(storage)
				.store(argThat(matchesFolder("thumbnails/md")), any(InputStream.class), any(StoreMeta.class));

		User user = TestUserHelper.createUser("orphan-cleanup");
		assertThrows(Throwable.class,
				() -> photoService.upload(jpegStream(Color.RED), "orphan.jpg", "image/jpeg", user));

		Optional<Photo> orphan = QuarkusTransaction.requiringNew()
				.call(() -> Photo.<Photo>find("uploader.id", user.id).firstResultOptional());
		assertTrue(orphan.isEmpty(), "Expected the orphan Photo row to be deleted after phase 1 failure");
	}

	@Test
	void nonDuplicatePersistFailurePreservesOriginalFailureAndCleansStoredFiles() throws IOException {
		Set<String> storedPaths = ConcurrentHashMap.newKeySet();
		doAnswer(invocation -> {
			StoragePath path = invocation.getArgument(0);
			storedPaths.add(path.path());
			return null;
		}).when(storage).store(any(StoragePath.class), any(InputStream.class), any(StoreMeta.class));
		doAnswer(invocation -> {
			StoragePath path = invocation.getArgument(0);
			storedPaths.add(path.path());
			return null;
		}).when(storage).store(any(StoragePath.class), any(Path.class), any(StoreMeta.class));

		User user = TestUserHelper.createUser("persist-failure");
		String overlongFilename = "x".repeat(513) + ".jpg";

		Throwable thrown = assertThrows(Throwable.class,
				() -> photoService.upload(jpegStream(Color.BLACK), overlongFilename, "image/jpeg", user));

		assertFalse(
				thrown instanceof IllegalStateException && thrown.getMessage() != null
						&& thrown.getMessage().contains("Duplicate hash conflict but photo not found"),
				"Non-duplicate persist failures must not be replaced by the duplicate-conflict fallback");
		assertInstanceOf(jakarta.persistence.PersistenceException.class, thrown,
				"The original persist failure should remain the surfaced failure");
		assertFalse(storedPaths.isEmpty(), "Test setup should store variants before the final persist failure");
		for (String path : storedPaths) {
			verify(storage, atLeastOnce()).delete(argThat((StoragePath sp) -> sp.path().equals(path)));
		}

		Optional<Photo> orphan = QuarkusTransaction.requiringNew()
				.call(() -> Photo.<Photo>find("uploader.id", user.id).firstResultOptional());
		assertTrue(orphan.isEmpty(), "Failed final persist must not leave a Photo row behind");
	}

	private static org.mockito.ArgumentMatcher<StoragePath> matchesFolder(String folderPrefix) {
		return path -> path != null && path.path() != null && path.path().contains(folderPrefix + "/");
	}

	private InputStream jpegStream(Color color) throws IOException {
		BufferedImage image = new BufferedImage(120, 90, BufferedImage.TYPE_INT_RGB);
		var g = image.createGraphics();
		g.setColor(color);
		g.fillRect(0, 0, 120, 90);
		g.dispose();
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		ImageIO.write(image, "jpg", out);
		return new ByteArrayInputStream(out.toByteArray());
	}
}
