package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.pina.backend.TestUserHelper;
import dev.pina.backend.api.dto.TrashItemDto;
import dev.pina.backend.api.dto.TrashListDto;
import dev.pina.backend.config.TrashConfig;
import dev.pina.backend.domain.FavoriteTargetType;
import dev.pina.backend.domain.Photo;
import dev.pina.backend.domain.User;
import dev.pina.backend.domain.VariantType;
import dev.pina.backend.storage.StoragePath;
import dev.pina.backend.storage.StorageProvider;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TrashServiceTest {

	@Inject
	TrashService trashService;

	@Inject
	PhotoService photoService;

	@Inject
	FavoriteService favoriteService;

	@Inject
	StorageProvider storage;

	@Inject
	EntityManager em;

	@Inject
	TrashConfig trashConfig;

	@Test
	@Transactional
	void purgeExpiredRemovesOnlyItemsPastRetention() throws IOException {
		User user = TestUserHelper.createUser("trash-retention");
		Photo expired = photoService.upload(jpegStream(Color.RED, 60, 60), "expired.jpg", "image/jpeg", user);
		Photo fresh = photoService.upload(jpegStream(Color.BLUE, 61, 61), "fresh.jpg", "image/jpeg", user);
		photoService.delete(expired.id);
		photoService.delete(fresh.id);

		OffsetDateTime now = OffsetDateTime.now();
		backdate("photos", expired.id, now.minusDays(trashConfig.retentionDays() + 3));
		backdate("photos", fresh.id, now.minusDays(trashConfig.retentionDays() - 3));

		TrashService.PurgeStats stats = trashService.purgeExpired(now);

		assertTrue(stats.photos() >= 1);
		assertEquals(0, rowCount("photos", expired.id));
		assertEquals(1, rowCount("photos", fresh.id));

		TrashListDto trash = trashService.list(user, TrashService.TrashKind.ALL, TrashService.TrashSort.DELETED);
		assertEquals(1, trash.items().size());
		assertEquals(fresh.id, trash.items().get(0).id());
	}

	@Test
	@Transactional
	void listComputesDaysLeftWithinDangerWindow() throws IOException {
		User user = TestUserHelper.createUser("trash-days");
		Photo photo = photoService.upload(jpegStream(Color.PINK, 62, 62), "soon.jpg", "image/jpeg", user);
		photoService.delete(photo.id);
		// Deleted (retention - 2) days ago → 2 days left → inside the <=3d danger
		// window.
		backdate("photos", photo.id, OffsetDateTime.now().minusDays(trashConfig.retentionDays() - 2));

		TrashListDto trash = trashService.list(user, TrashService.TrashKind.ALL, TrashService.TrashSort.SOON);
		assertEquals(1, trash.items().size());
		TrashItemDto item = trash.items().get(0);
		assertEquals(2, item.daysLeft());
		assertTrue(item.sizeBytes() > 0);
	}

	@Test
	@Transactional
	void userPurgeRemovesRowAndFavorite() throws IOException {
		User user = TestUserHelper.createUser("trash-purge-row");
		Photo photo = photoService.upload(jpegStream(Color.ORANGE, 63, 63), "fav.jpg", "image/jpeg", user);
		favoriteService.add(FavoriteTargetType.PHOTO, photo.id, user);
		assertEquals(1, rowCount("favorites", photo.id, "target_id"));

		photoService.delete(photo.id);
		trashService.purge(user, List.of(photo.id), List.of());

		assertEquals(0, rowCount("photos", photo.id));
		assertEquals(0, rowCount("favorites", photo.id, "target_id"));
	}

	@Test
	void purgeFreesStoredVariantsButSoftDeleteDoesNot() throws IOException {
		User user = TestUserHelper.createUser("trash-storage");
		Photo photo = photoService.upload(jpegStream(Color.GREEN, 64, 64), "doomed.jpg", "image/jpeg", user);
		String compressedPath = photo.variants.stream().filter(v -> v.variantType == VariantType.COMPRESSED).findFirst()
				.orElseThrow().storagePath;
		StoragePath path = new StoragePath(compressedPath);

		// Soft-delete leaves the stored variant in place.
		photoService.delete(photo.id);
		assertTrue(storage.exists(path));

		// Purge deletes it (after the purge transaction commits).
		trashService.purge(user, List.of(photo.id), List.of());
		assertFalse(storage.exists(path));
	}

	private long rowCount(String table, UUID id) {
		return rowCount(table, id, "id");
	}

	private long rowCount(String table, UUID id, String column) {
		return ((Number) em.createNativeQuery("SELECT COUNT(*) FROM " + table + " WHERE " + column + " = :id")
				.setParameter("id", id).getSingleResult()).longValue();
	}

	private void backdate(String table, UUID id, OffsetDateTime timestamp) {
		em.createNativeQuery("UPDATE " + table + " SET deleted_at = :ts WHERE id = :id").setParameter("ts", timestamp)
				.setParameter("id", id).executeUpdate();
	}

	private InputStream jpegStream(Color color, int width, int height) throws IOException {
		BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
		var g = image.createGraphics();
		g.setColor(color);
		g.fillRect(0, 0, width, height);
		g.dispose();
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		ImageIO.write(image, "jpg", out);
		return new ByteArrayInputStream(out.toByteArray());
	}
}
