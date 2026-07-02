package dev.pina.backend.service;

import dev.pina.backend.api.dto.TrashItemDto;
import dev.pina.backend.api.dto.TrashListDto;
import dev.pina.backend.api.dto.TrashSummaryDto;
import dev.pina.backend.config.TrashConfig;
import dev.pina.backend.domain.User;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import java.text.Collator;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * The "Корзина" (Trash) read model and its restore / purge / empty operations.
 *
 * <p>
 * Trashed rows are hidden from the Photo/Album entity mappings by their
 * {@code @SQLRestriction("deleted_at is null")}, so every method here reads and
 * mutates them through native SQL. All operations are strictly owner-scoped:
 * ids that the caller does not own (or that are no longer trashed) are silently
 * skipped. Permanent removal is delegated to {@link PhotoService#purge} and
 * {@link AlbumService#purge}, which also free storage and favorites.
 */
@ApplicationScoped
public class TrashService {

	private static final long DAY_SECONDS = 86_400L;

	@Inject
	EntityManager em;

	@Inject
	TrashConfig trashConfig;

	@Inject
	PhotoService photoService;

	@Inject
	AlbumService albumService;

	public enum TrashKind {
		ALL, PHOTO, ALBUM;

		public static TrashKind parse(String raw) {
			if (raw == null || raw.isBlank()) {
				return ALL;
			}
			return switch (raw.strip().toLowerCase(Locale.ROOT)) {
				case "all" -> ALL;
				case "photo" -> PHOTO;
				case "album" -> ALBUM;
				default -> throw new IllegalArgumentException("Invalid kind: " + raw);
			};
		}
	}

	public enum TrashSort {
		DELETED, SOON, NAME;

		public static TrashSort parse(String raw) {
			if (raw == null || raw.isBlank()) {
				return DELETED;
			}
			return switch (raw.strip().toLowerCase(Locale.ROOT)) {
				case "deleted" -> DELETED;
				case "soon" -> SOON;
				case "name" -> NAME;
				default -> throw new IllegalArgumentException("Invalid sort: " + raw);
			};
		}
	}

	public record PurgeStats(int photos, int albums) {

		public int total() {
			return photos + albums;
		}
	}

	@Transactional
	public TrashListDto list(User owner, TrashKind kind, TrashSort sort) {
		OffsetDateTime now = OffsetDateTime.now();
		int retentionDays = trashConfig.retentionDays();

		List<TrashItemDto> photos = loadTrashedPhotos(owner.id, now, retentionDays);
		List<TrashItemDto> albums = loadTrashedAlbums(owner.id, now, retentionDays);

		// The summary always reflects the whole trash, regardless of the kind filter.
		List<TrashItemDto> all = new ArrayList<>(photos.size() + albums.size());
		all.addAll(photos);
		all.addAll(albums);
		TrashSummaryDto summary = summarize(all);

		List<TrashItemDto> filtered = switch (kind) {
			case ALL -> all;
			case PHOTO -> photos;
			case ALBUM -> albums;
		};
		List<TrashItemDto> items = new ArrayList<>(filtered);
		items.sort(comparatorFor(sort));
		return new TrashListDto(items, summary);
	}

	/**
	 * Restore owned, still-trashed items to their libraries. Unknown/foreign ids
	 * are skipped.
	 */
	@Transactional
	public void restore(User owner, List<UUID> photoIds, List<UUID> albumIds) {
		if (photoIds != null && !photoIds.isEmpty()) {
			em.createNativeQuery(
					"UPDATE photos SET deleted_at = NULL WHERE id IN (:ids) AND uploader_id = :ownerId AND deleted_at IS NOT NULL")
					.setParameter("ids", photoIds).setParameter("ownerId", owner.id).executeUpdate();
		}
		if (albumIds != null && !albumIds.isEmpty()) {
			em.createNativeQuery(
					"UPDATE albums SET deleted_at = NULL WHERE id IN (:ids) AND owner_id = :ownerId AND space_id IS NULL AND deleted_at IS NOT NULL")
					.setParameter("ids", albumIds).setParameter("ownerId", owner.id).executeUpdate();
		}
	}

	/**
	 * Permanently remove the caller's owned, still-trashed items among the given
	 * ids.
	 */
	@Transactional
	public void purge(User owner, List<UUID> photoIds, List<UUID> albumIds) {
		photoService.purge(ownedTrashedPhotoIds(owner.id, photoIds));
		albumService.purge(ownedTrashedAlbumIds(owner.id, albumIds));
	}

	/** Permanently remove every one of the caller's trashed items. */
	@Transactional
	public void emptyTrash(User owner) {
		photoService.purge(allTrashedPhotoIds(owner.id));
		albumService.purge(allTrashedAlbumIds(owner.id));
	}

	/**
	 * Permanently remove every item whose retention window has elapsed
	 * ({@code deleted_at <= now - retentionDays}), across all owners. Called by
	 * {@code TrashPurgeJob}.
	 */
	@Transactional
	public PurgeStats purgeExpired(OffsetDateTime now) {
		OffsetDateTime cutoff = now.minusDays(trashConfig.retentionDays());
		List<UUID> photoIds = idColumn(
				em.createNativeQuery("SELECT id FROM photos WHERE deleted_at IS NOT NULL AND deleted_at <= :cutoff")
						.setParameter("cutoff", cutoff).getResultList());
		List<UUID> albumIds = idColumn(
				em.createNativeQuery("SELECT id FROM albums WHERE deleted_at IS NOT NULL AND deleted_at <= :cutoff")
						.setParameter("cutoff", cutoff).getResultList());
		photoService.purge(photoIds);
		albumService.purge(albumIds);
		return new PurgeStats(photoIds.size(), albumIds.size());
	}

	private List<TrashItemDto> loadTrashedPhotos(UUID ownerId, OffsetDateTime now, int retentionDays) {
		List<?> rows = em.createNativeQuery("""
				SELECT p.id, p.original_filename, p.deleted_at,
				       COALESCE((SELECT SUM(pv.size_bytes) FROM photo_variants pv WHERE pv.photo_id = p.id), 0)
				FROM photos p
				WHERE p.uploader_id = :ownerId AND p.deleted_at IS NOT NULL
				""").setParameter("ownerId", ownerId).getResultList();
		List<TrashItemDto> items = new ArrayList<>(rows.size());
		for (Object raw : rows) {
			Object[] row = (Object[]) raw;
			UUID id = (UUID) row[0];
			String name = row[1] != null ? (String) row[1] : "";
			OffsetDateTime deletedAt = toOffsetDateTime(row[2]);
			long sizeBytes = ((Number) row[3]).longValue();
			OffsetDateTime purgeAt = deletedAt.plusDays(retentionDays);
			items.add(new TrashItemDto("PHOTO", id, name, sizeBytes, deletedAt, purgeAt, daysLeft(purgeAt, now), null));
		}
		return items;
	}

	private List<TrashItemDto> loadTrashedAlbums(UUID ownerId, OffsetDateTime now, int retentionDays) {
		List<?> rows = em.createNativeQuery("""
				SELECT a.id, a.name, a.deleted_at,
				       (SELECT COUNT(*) FROM album_photos ap JOIN photos ph ON ph.id = ap.photo_id
				        WHERE ap.album_id = a.id AND ph.deleted_at IS NULL)
				FROM albums a
				WHERE a.owner_id = :ownerId AND a.space_id IS NULL AND a.deleted_at IS NOT NULL
				""").setParameter("ownerId", ownerId).getResultList();
		List<TrashItemDto> items = new ArrayList<>(rows.size());
		for (Object raw : rows) {
			Object[] row = (Object[]) raw;
			UUID id = (UUID) row[0];
			String name = row[1] != null ? (String) row[1] : "";
			OffsetDateTime deletedAt = toOffsetDateTime(row[2]);
			int photoCount = ((Number) row[3]).intValue();
			OffsetDateTime purgeAt = deletedAt.plusDays(retentionDays);
			items.add(new TrashItemDto("ALBUM", id, name, 0L, deletedAt, purgeAt, daysLeft(purgeAt, now), photoCount));
		}
		return items;
	}

	private TrashSummaryDto summarize(List<TrashItemDto> all) {
		long totalBytes = 0;
		int soonest = 0;
		boolean first = true;
		for (TrashItemDto item : all) {
			totalBytes += item.sizeBytes();
			if (first || item.daysLeft() < soonest) {
				soonest = item.daysLeft();
				first = false;
			}
		}
		return new TrashSummaryDto(all.size(), totalBytes, soonest);
	}

	private Comparator<TrashItemDto> comparatorFor(TrashSort sort) {
		return switch (sort) {
			case DELETED -> Comparator.comparing(TrashItemDto::deletedAt).reversed().thenComparing(TrashItemDto::id);
			case SOON -> Comparator.comparing(TrashItemDto::purgeAt).thenComparing(TrashItemDto::id);
			case NAME -> {
				Collator collator = Collator.getInstance(Locale.forLanguageTag("ru"));
				yield Comparator.<TrashItemDto, String>comparing(TrashItemDto::name, collator)
						.thenComparing(TrashItemDto::id);
			}
		};
	}

	private int daysLeft(OffsetDateTime purgeAt, OffsetDateTime now) {
		long seconds = Duration.between(now, purgeAt).getSeconds();
		if (seconds <= 0) {
			return 0;
		}
		return (int) ((seconds + DAY_SECONDS - 1) / DAY_SECONDS);
	}

	private List<UUID> ownedTrashedPhotoIds(UUID ownerId, List<UUID> ids) {
		if (ids == null || ids.isEmpty()) {
			return List.of();
		}
		return idColumn(em.createNativeQuery(
				"SELECT id FROM photos WHERE id IN (:ids) AND uploader_id = :ownerId AND deleted_at IS NOT NULL")
				.setParameter("ids", ids).setParameter("ownerId", ownerId).getResultList());
	}

	private List<UUID> ownedTrashedAlbumIds(UUID ownerId, List<UUID> ids) {
		if (ids == null || ids.isEmpty()) {
			return List.of();
		}
		return idColumn(em.createNativeQuery(
				"SELECT id FROM albums WHERE id IN (:ids) AND owner_id = :ownerId AND space_id IS NULL AND deleted_at IS NOT NULL")
				.setParameter("ids", ids).setParameter("ownerId", ownerId).getResultList());
	}

	private List<UUID> allTrashedPhotoIds(UUID ownerId) {
		return idColumn(
				em.createNativeQuery("SELECT id FROM photos WHERE uploader_id = :ownerId AND deleted_at IS NOT NULL")
						.setParameter("ownerId", ownerId).getResultList());
	}

	private List<UUID> allTrashedAlbumIds(UUID ownerId) {
		return idColumn(em.createNativeQuery(
				"SELECT id FROM albums WHERE owner_id = :ownerId AND space_id IS NULL AND deleted_at IS NOT NULL")
				.setParameter("ownerId", ownerId).getResultList());
	}

	private static List<UUID> idColumn(List<?> rows) {
		List<UUID> ids = new ArrayList<>(rows.size());
		for (Object row : rows) {
			ids.add((UUID) row);
		}
		return ids;
	}

	private static OffsetDateTime toOffsetDateTime(Object value) {
		if (value == null) {
			return null;
		}
		if (value instanceof OffsetDateTime offsetDateTime) {
			return offsetDateTime;
		}
		if (value instanceof java.time.Instant instant) {
			return instant.atOffset(ZoneOffset.UTC);
		}
		if (value instanceof java.sql.Timestamp timestamp) {
			return timestamp.toInstant().atOffset(ZoneOffset.UTC);
		}
		throw new IllegalArgumentException("Unsupported timestamp value: " + value.getClass().getName());
	}
}
