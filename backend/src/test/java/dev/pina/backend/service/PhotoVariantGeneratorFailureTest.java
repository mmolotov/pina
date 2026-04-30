package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import dev.pina.backend.TestUserHelper;
import dev.pina.backend.domain.Photo;
import dev.pina.backend.domain.User;
import dev.pina.backend.storage.StoragePath;
import dev.pina.backend.storage.StorageProvider;
import dev.pina.backend.storage.StoreMeta;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Path;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

@QuarkusTest
class PhotoVariantGeneratorFailureTest {

	@Inject
	PhotoService photoService;

	@InjectMock
	StorageProvider storage;

	@Test
	@Transactional
	void failureDuringOneVariantCleansUpOthersAndPropagatesFailure() throws IOException {
		// Track which paths we accept stores for so we can later assert they were
		// deleted as part of the cleanup-on-failure path.
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

		// Force exactly one variant to fail. Choosing THUMB_MD targets the parallel
		// code path mid-batch so siblings have already started or finished.
		doThrow(new UncheckedIOException("simulated", new IOException("simulated"))).when(storage)
				.store(argThat(matchesFolder("thumbnails/md")), any(InputStream.class), any(StoreMeta.class));

		User user = TestUserHelper.createUser("variant-failure");
		Throwable thrown = assertThrows(Throwable.class,
				() -> photoService.upload(jpegStream(), "fail.jpg", "image/jpeg", user));

		// The original failure must be surfaced (or its cause), not a generic wrapper.
		assertTrue(
				thrown instanceof UncheckedIOException || thrown.getCause() instanceof UncheckedIOException
						|| (thrown.getMessage() != null && thrown.getMessage().contains("simulated")),
				"Expected the original failure to be surfaced, got: " + thrown);

		// Every variant whose store completed before the failure must be cleaned up.
		// The mock records all successful stores in `storedPaths`; for each of those
		// the cleanup path should issue a delete. The failing path itself never
		// completed, so it does not need a delete.
		for (String path : storedPaths) {
			verify(storage, atLeast(1)).delete(argThat((StoragePath sp) -> sp.path().equals(path)));
		}

		// No orphan Photo row should be left behind: PhotoService.upload deletes the
		// entity when generateAll throws.
		Optional<Photo> orphan = Photo.find("uploader.id", user.id).firstResultOptional();
		assertTrue(orphan.isEmpty(), "Expected the orphan Photo row to be deleted after variant generation failure");
	}

	private static org.mockito.ArgumentMatcher<StoragePath> matchesFolder(String folderPrefix) {
		return path -> path != null && path.path() != null && path.path().contains(folderPrefix + "/");
	}

	private InputStream jpegStream() throws IOException {
		BufferedImage image = new BufferedImage(120, 90, BufferedImage.TYPE_INT_RGB);
		var g = image.createGraphics();
		g.setColor(Color.MAGENTA);
		g.fillRect(0, 0, 120, 90);
		g.dispose();
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		ImageIO.write(image, "jpg", out);
		return new ByteArrayInputStream(out.toByteArray());
	}
}
