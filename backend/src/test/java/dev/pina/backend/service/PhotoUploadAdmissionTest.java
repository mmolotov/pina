package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;

import dev.pina.backend.TestUserHelper;
import dev.pina.backend.domain.User;
import dev.pina.backend.storage.StoragePath;
import dev.pina.backend.storage.StorageProvider;
import dev.pina.backend.storage.StoreMeta;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

/**
 * Verifies the {@link PhotoUploadAdmission} cap actually serializes the
 * image-heavy phase: with a cap of {@code 2}, at most two uploads may be
 * simultaneously past the admission gate (in decode + storage), regardless of
 * how many concurrent HTTP-equivalent calls are racing into
 * {@link PhotoService#upload}.
 */
@QuarkusTest
@TestProfile(PhotoUploadAdmissionTest.SmallCapProfile.class)
class PhotoUploadAdmissionTest {

	private static final int CAP = 2;
	private static final int CONCURRENT_UPLOADS = 5;

	public static class SmallCapProfile implements QuarkusTestProfile {
		@Override
		public Map<String, String> getConfigOverrides() {
			return Map.of("pina.photo.heavy-phase.max-concurrent", String.valueOf(CAP));
		}
	}

	@Inject
	PhotoService photoService;

	@Inject
	PhotoUploadAdmission admission;

	@InjectMock
	StorageProvider storage;

	@Test
	void heavyPhaseIsCappedRegardlessOfRequestCount() throws Exception {
		assertEquals(CAP, admission.capacity(),
				"Profile must apply: PhotoUploadAdmission should report the configured cap");

		AtomicInteger maxObservedInFlight = new AtomicInteger();
		CountDownLatch releaseStorage = new CountDownLatch(1);
		CountDownLatch firstWaveSeen = new CountDownLatch(CAP);

		doAnswer(invocation -> {
			recordAndPark(maxObservedInFlight, firstWaveSeen, releaseStorage);
			return null;
		}).when(storage).store(any(StoragePath.class), any(InputStream.class), any(StoreMeta.class));
		doAnswer(invocation -> {
			recordAndPark(maxObservedInFlight, firstWaveSeen, releaseStorage);
			return null;
		}).when(storage).store(any(StoragePath.class), any(Path.class), any(StoreMeta.class));

		User user = TestUserHelper.createUser("admission");
		ExecutorService runner = Executors.newFixedThreadPool(CONCURRENT_UPLOADS);
		try {
			List<CompletableFuture<Void>> uploads = new ArrayList<>();
			for (int i = 0; i < CONCURRENT_UPLOADS; i++) {
				int index = i;
				uploads.add(CompletableFuture.runAsync(() -> {
					try {
						photoService.upload(jpegStream(uniqueColor(index)), "u-" + index + ".jpg", "image/jpeg", user);
					} catch (IOException e) {
						throw new RuntimeException(e);
					}
				}, runner));
			}

			// Wait until the first wave has saturated the cap.
			assertTrue(firstWaveSeen.await(15, TimeUnit.SECONDS),
					"first " + CAP + " uploads never reached the storage phase");

			// Give would-be over-cap uploads a generous chance to slip past
			// admission and bump the counter beyond CAP. They must not.
			Thread.sleep(200);
			assertEquals(CAP, admission.inFlight(),
					"Exactly CAP uploads must hold an admission slot while the rest are blocked on acquire()");

			// Release storage and let every upload finish.
			releaseStorage.countDown();
			CompletableFuture.allOf(uploads.toArray(CompletableFuture[]::new)).get(30, TimeUnit.SECONDS);

			assertEquals(CAP, maxObservedInFlight.get(),
					"PhotoUploadAdmission.inFlight() must never have exceeded the configured cap");
			assertEquals(0, admission.inFlight(), "All slots must be released after every upload completes");
		} finally {
			runner.shutdownNow();
		}
	}

	private void recordAndPark(AtomicInteger maxObservedInFlight, CountDownLatch firstWaveSeen,
			CountDownLatch releaseStorage) throws InterruptedException {
		int observed = admission.inFlight();
		maxObservedInFlight.updateAndGet(prev -> Math.max(prev, observed));
		firstWaveSeen.countDown();
		releaseStorage.await();
	}

	private static Color uniqueColor(int index) {
		// Each upload gets distinct content so dedup does not short-circuit any of
		// them past the admission gate.
		int seed = (index * 91 + 17) & 0xFF;
		return new Color(seed, (seed * 53) & 0xFF, (seed * 19) & 0xFF);
	}

	private static InputStream jpegStream(Color color) throws IOException {
		BufferedImage image = new BufferedImage(120, 90, BufferedImage.TYPE_INT_RGB);
		var g = image.createGraphics();
		g.setColor(color);
		g.fillRect(0, 0, 120, 90);
		// Add a deterministic noise patch so JPEG compression cannot collapse
		// distinct fixtures to the same bytes (and therefore the same hash).
		for (int x = 0; x < 16; x++) {
			for (int y = 0; y < 16; y++) {
				int rgb = (x * y * (color.getRGB() | 1)) & 0xFFFFFF;
				image.setRGB(x, y, rgb);
			}
		}
		g.dispose();
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		ImageIO.write(image, "jpg", out);
		return new ByteArrayInputStream(out.toByteArray());
	}
}
