package dev.pina.backend.service;

import dev.pina.backend.domain.Album;
import dev.pina.backend.domain.AlbumPhoto;
import dev.pina.backend.domain.FavoriteTargetType;
import dev.pina.backend.domain.PersonalLibrary;
import dev.pina.backend.domain.Photo;
import dev.pina.backend.domain.Space;
import dev.pina.backend.domain.User;
import dev.pina.backend.pagination.PageRequest;
import dev.pina.backend.pagination.PageResult;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceException;
import jakarta.transaction.Transactional;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@ApplicationScoped
public class AlbumService {

	private static final int MAX_PAGE_SIZE = 100;
	private static final String FAVORITE_TARGET_LOCK_NAMESPACE = "favorite-target-album";
	private static final String SPACE_CONTENT_LOCK_NAMESPACE = "space-content";

	public enum AddPhotoResult {
		CREATED, ALREADY_EXISTS, NOT_FOUND, PHOTO_NOT_ACCESSIBLE
	}

	public enum RemovePhotoResult {
		REMOVED, NOT_FOUND, FORBIDDEN
	}

	public sealed interface SetCoverResult {
		record Set(Album album) implements SetCoverResult {
		}

		record AlbumNotFound() implements SetCoverResult {
		}

		record PhotoNotInAlbum() implements SetCoverResult {
		}
	}

	public enum SortField {
		NAME, ITEM_COUNT, CREATED_AT, UPDATED_AT, NEWEST_PHOTO;

		public static SortField parse(String raw) {
			if (raw == null || raw.isBlank()) {
				return CREATED_AT;
			}
			return switch (raw.strip().toLowerCase(Locale.ROOT)) {
				case "name" -> NAME;
				case "itemcount" -> ITEM_COUNT;
				case "createdat" -> CREATED_AT;
				case "updatedat" -> UPDATED_AT;
				case "newestphoto" -> NEWEST_PHOTO;
				default -> throw new IllegalArgumentException("Invalid sort: " + raw);
			};
		}

		public SortDirection defaultDirection() {
			return this == NAME ? SortDirection.ASC : SortDirection.DESC;
		}
	}

	public enum SortDirection {
		ASC, DESC;

		public static SortDirection parse(String raw, SortDirection defaultDirection) {
			if (raw == null || raw.isBlank()) {
				return defaultDirection;
			}
			return switch (raw.strip().toLowerCase(Locale.ROOT)) {
				case "asc" -> ASC;
				case "desc" -> DESC;
				default -> throw new IllegalArgumentException("Invalid direction: " + raw);
			};
		}
	}

	@Inject
	EntityManager em;

	@Inject
	PersonalLibraryService personalLibraryService;

	@Inject
	FavoriteService favoriteService;

	@Inject
	TransactionalLockService lockService;

	@Transactional
	public Album create(String name, String description, User owner) {
		PersonalLibrary personalLibrary = personalLibraryService.getOrCreate(owner);

		Album album = new Album();
		album.name = name;
		album.description = description;
		album.owner = owner;
		album.personalLibrary = personalLibrary;
		album.persist();
		return album;
	}

	@Transactional
	public Album createSpaceAlbum(String name, String description, Space space, User owner) {
		lockService.lock(SPACE_CONTENT_LOCK_NAMESPACE, space.id);
		Album album = new Album();
		album.name = name;
		album.description = description;
		album.owner = owner;
		album.space = space;
		album.persist();
		return album;
	}

	public Optional<Album> findById(UUID id) {
		return Album.findByIdOptional(id);
	}

	public Optional<Photo> findPhotoInAlbum(UUID albumId, UUID photoId) {
		return em.createQuery(
				"SELECT DISTINCT p FROM AlbumPhoto ap JOIN ap.photo p LEFT JOIN FETCH p.variants LEFT JOIN FETCH p.uploader LEFT JOIN FETCH p.personalLibrary WHERE ap.album.id = :albumId AND p.id = :photoId",
				Photo.class).setParameter("albumId", albumId).setParameter("photoId", photoId).getResultStream()
				.findFirst();
	}

	@Transactional
	public boolean delete(UUID id) {
		Album album = em.find(Album.class, id, LockModeType.PESSIMISTIC_WRITE);
		if (album == null) {
			return false;
		}
		lockService.lock(FAVORITE_TARGET_LOCK_NAMESPACE, id);
		favoriteService.removeForTarget(FavoriteTargetType.ALBUM, id);
		AlbumPhoto.delete("album.id", id);
		album.delete();
		return true;
	}

	public PageResult<Album> listByOwner(UUID ownerId, PageRequest pageRequest, SortField sort,
			SortDirection direction) {
		return listAlbums(pageRequest, sort, direction,
				"SELECT a.id FROM Album a WHERE a.personalLibrary.owner.id = :ownerId",
				"SELECT COUNT(a) FROM Album a WHERE a.personalLibrary.owner.id = :ownerId",
				"LEFT JOIN FETCH a.owner LEFT JOIN FETCH a.personalLibrary", "ownerId", ownerId);
	}

	public PageResult<Album> listBySpace(UUID spaceId, PageRequest pageRequest, SortField sort,
			SortDirection direction) {
		return listAlbums(pageRequest, sort, direction, "SELECT a.id FROM Album a WHERE a.space.id = :spaceId",
				"SELECT COUNT(a) FROM Album a WHERE a.space.id = :spaceId",
				"LEFT JOIN FETCH a.owner LEFT JOIN FETCH a.space", "spaceId", spaceId);
	}

	private PageResult<Album> listAlbums(PageRequest pageRequest, SortField sort, SortDirection direction,
			String idSelect, String countQuery, String fetchJoins, String paramName, Object paramValue) {
		int effectiveSize = pageRequest.effectiveSize(MAX_PAGE_SIZE);
		String orderBy = buildOrderByClause(sort, direction);
		List<UUID> idsWithLookahead = em.createQuery(idSelect + " ORDER BY " + orderBy, UUID.class)
				.setParameter(paramName, paramValue).setFirstResult(pageRequest.offset(MAX_PAGE_SIZE))
				.setMaxResults(effectiveSize + 1).getResultList();
		boolean hasNext = idsWithLookahead.size() > effectiveSize;
		List<UUID> pageIds = hasNext ? idsWithLookahead.subList(0, effectiveSize) : idsWithLookahead;

		List<Album> items = fetchAlbumsInOrder(pageIds, fetchJoins);

		Long totalItems = null;
		Long totalPages = null;
		if (pageRequest.needsTotal()) {
			totalItems = em.createQuery(countQuery, Long.class).setParameter(paramName, paramValue).getSingleResult();
			totalPages = PageResult.totalPages(totalItems, effectiveSize);
		}
		return new PageResult<>(items, pageRequest.page(), effectiveSize, hasNext, totalItems, totalPages);
	}

	private List<Album> fetchAlbumsInOrder(List<UUID> ids, String fetchJoins) {
		if (ids.isEmpty()) {
			return List.of();
		}
		List<Album> albums = em
				.createQuery("SELECT DISTINCT a FROM Album a " + fetchJoins + " WHERE a.id IN :ids", Album.class)
				.setParameter("ids", ids).getResultList();
		Map<UUID, Album> byId = new HashMap<>(albums.size() * 2);
		for (Album album : albums) {
			byId.put(album.id, album);
		}
		return ids.stream().map(byId::get).filter(Objects::nonNull).toList();
	}

	private String buildOrderByClause(SortField sort, SortDirection direction) {
		String dir = direction == SortDirection.ASC ? "ASC" : "DESC";
		String nullsClause = "";
		String sortExpr = switch (sort) {
			case NAME -> "a.name";
			case ITEM_COUNT -> "(SELECT COUNT(ap) FROM AlbumPhoto ap WHERE ap.album.id = a.id)";
			case CREATED_AT -> "a.createdAt";
			case UPDATED_AT -> "a.updatedAt";
			case NEWEST_PHOTO ->
				"(SELECT MAX(COALESCE(p.takenAt, p.createdAt)) FROM AlbumPhoto ap JOIN ap.photo p WHERE ap.album.id = a.id)";
		};
		if (sort == SortField.NEWEST_PHOTO) {
			nullsClause = direction == SortDirection.ASC ? " NULLS FIRST" : " NULLS LAST";
		}
		return sortExpr + " " + dir + nullsClause + ", a.id " + dir;
	}

	/**
	 * Enrich a single album with photo-count, media-date range, and resolved cover
	 * photo (explicit or auto). Issues the same bounded set of queries as
	 * {@link #buildSummaries(List)}.
	 */
	public AlbumSummary getSummary(Album album) {
		return buildSummaries(List.of(album)).get(0);
	}

	/**
	 * Enrich a batch of albums with aggregate statistics and resolved cover photos
	 * while preserving the input order. Regardless of the batch size this performs
	 * a bounded number of queries: one JPQL aggregate, one native
	 * {@code DISTINCT ON} to resolve auto-covers, and one JPQL load to fetch the
	 * cover photos with their variants.
	 */
	public List<AlbumSummary> buildSummaries(List<Album> albums) {
		if (albums.isEmpty()) {
			return List.of();
		}

		List<UUID> albumIds = albums.stream().map(a -> a.id).toList();

		record Aggregate(long photoCount, OffsetDateTime mediaRangeStart, OffsetDateTime mediaRangeEnd,
				OffsetDateTime latestPhotoAddedAt) {
		}
		Map<UUID, Aggregate> aggregatesByAlbum = new HashMap<>();
		List<Object[]> aggregateRows = em.createQuery(
				"SELECT ap.album.id, COUNT(ap), MIN(COALESCE(p.takenAt, p.createdAt)), MAX(COALESCE(p.takenAt, p.createdAt)), MAX(ap.addedAt) "
						+ "FROM AlbumPhoto ap JOIN ap.photo p WHERE ap.album.id IN :ids GROUP BY ap.album.id",
				Object[].class).setParameter("ids", albumIds).getResultList();
		for (Object[] row : aggregateRows) {
			UUID albumId = (UUID) row[0];
			long count = ((Number) row[1]).longValue();
			OffsetDateTime rangeStart = (OffsetDateTime) row[2];
			OffsetDateTime rangeEnd = (OffsetDateTime) row[3];
			OffsetDateTime latestAddedAt = (OffsetDateTime) row[4];
			aggregatesByAlbum.put(albumId, new Aggregate(count, rangeStart, rangeEnd, latestAddedAt));
		}

		Map<UUID, UUID> coverPhotoByAlbum = new HashMap<>();
		Set<UUID> coverPhotoIds = new HashSet<>();
		List<UUID> autoResolveAlbumIds = new ArrayList<>();
		for (Album album : albums) {
			Aggregate agg = aggregatesByAlbum.get(album.id);
			if (agg == null || agg.photoCount() == 0) {
				continue;
			}
			if (album.coverPhoto != null) {
				coverPhotoByAlbum.put(album.id, album.coverPhoto.id);
				coverPhotoIds.add(album.coverPhoto.id);
			} else {
				autoResolveAlbumIds.add(album.id);
			}
		}

		if (!autoResolveAlbumIds.isEmpty()) {
			@SuppressWarnings("unchecked")
			List<Object[]> autoRows = em
					.createNativeQuery("SELECT DISTINCT ON (ap.album_id) ap.album_id, ap.photo_id FROM album_photos ap "
							+ "JOIN photos p ON p.id = ap.photo_id WHERE ap.album_id IN (:ids) "
							+ "ORDER BY ap.album_id, COALESCE(p.taken_at, p.created_at) DESC, ap.added_at DESC")
					.setParameter("ids", autoResolveAlbumIds).getResultList();
			for (Object[] row : autoRows) {
				UUID albumId = (UUID) row[0];
				UUID photoId = (UUID) row[1];
				coverPhotoByAlbum.put(albumId, photoId);
				coverPhotoIds.add(photoId);
			}
		}

		Map<UUID, Photo> coverPhotosById = new HashMap<>();
		if (!coverPhotoIds.isEmpty()) {
			List<Photo> photos = em.createQuery(
					"SELECT DISTINCT p FROM Photo p LEFT JOIN FETCH p.variants LEFT JOIN FETCH p.uploader LEFT JOIN FETCH p.personalLibrary WHERE p.id IN :ids",
					Photo.class).setParameter("ids", coverPhotoIds).getResultList();
			for (Photo photo : photos) {
				coverPhotosById.put(photo.id, photo);
			}
		}

		List<AlbumSummary> summaries = new ArrayList<>(albums.size());
		for (Album album : albums) {
			Aggregate agg = aggregatesByAlbum.get(album.id);
			if (agg == null) {
				summaries.add(AlbumSummary.empty(album));
				continue;
			}
			UUID coverId = coverPhotoByAlbum.get(album.id);
			Photo cover = coverId == null ? null : coverPhotosById.get(coverId);
			summaries.add(new AlbumSummary(album, agg.photoCount(), agg.mediaRangeStart(), agg.mediaRangeEnd(),
					agg.latestPhotoAddedAt(), cover));
		}
		return summaries;
	}

	public boolean hasPhoto(Album album, Photo photo) {
		return AlbumPhoto.find("album.id = ?1 and photo.id = ?2", album.id, photo.id).count() > 0;
	}

	@Transactional
	public AddPhotoResult addPhoto(UUID albumId, UUID photoId, User addedBy) {
		Optional<Album> album = Album.findByIdOptional(albumId);
		Optional<Photo> photo = Photo.findByIdWithRelations(photoId);
		if (album.isEmpty() || photo.isEmpty()) {
			return AddPhotoResult.NOT_FOUND;
		}
		if (!photo.get().uploader.id.equals(addedBy.id)) {
			return AddPhotoResult.PHOTO_NOT_ACCESSIBLE;
		}
		if (hasPhoto(album.get(), photo.get())) {
			return AddPhotoResult.ALREADY_EXISTS;
		}

		AlbumPhoto ap = new AlbumPhoto();
		ap.album = album.get();
		ap.photo = photo.get();
		ap.addedBy = addedBy;
		try {
			ap.persistAndFlush();
			return AddPhotoResult.CREATED;
		} catch (PersistenceException _) {
			return AddPhotoResult.ALREADY_EXISTS;
		}
	}

	@Transactional
	public Optional<Album> update(UUID id, String name, String description) {
		Optional<Album> album = Album.findByIdOptional(id);
		if (album.isEmpty()) {
			return Optional.empty();
		}
		Album a = album.get();
		a.name = name;
		a.description = description;
		a.persistAndFlush();
		return Optional.of(a);
	}

	@Transactional
	public boolean removePhoto(UUID albumId, UUID photoId) {
		return AlbumPhoto.delete("album.id = ?1 and photo.id = ?2", albumId, photoId) > 0;
	}

	@Transactional
	public RemovePhotoResult removePhoto(UUID albumId, UUID photoId, User actingUser, boolean canManageAlbum) {
		Optional<AlbumPhoto> albumPhoto = findAlbumPhotoForRemoval(albumId, photoId);
		if (albumPhoto.isEmpty()) {
			return RemovePhotoResult.NOT_FOUND;
		}
		return removeFetchedPhotoReference(albumId, photoId, albumPhoto.get(), actingUser, canManageAlbum);
	}

	Optional<AlbumPhoto> findAlbumPhotoForRemoval(UUID albumId, UUID photoId) {
		return AlbumPhoto.getEntityManager().createQuery(
				"SELECT ap FROM AlbumPhoto ap JOIN FETCH ap.photo p JOIN FETCH p.uploader WHERE ap.album.id = :albumId AND ap.photo.id = :photoId",
				AlbumPhoto.class).setParameter("albumId", albumId).setParameter("photoId", photoId).getResultStream()
				.findFirst();
	}

	RemovePhotoResult removeFetchedPhotoReference(UUID albumId, UUID photoId, AlbumPhoto albumPhoto, User actingUser,
			boolean canManageAlbum) {
		if (!canManageAlbum && !albumPhoto.photo.uploader.id.equals(actingUser.id)) {
			return RemovePhotoResult.FORBIDDEN;
		}

		em.createQuery("UPDATE Album a SET a.coverPhoto = null WHERE a.id = :albumId AND a.coverPhoto.id = :photoId")
				.setParameter("albumId", albumId).setParameter("photoId", photoId).executeUpdate();
		return AlbumPhoto.delete("album.id = ?1 and photo.id = ?2", albumId, photoId) > 0
				? RemovePhotoResult.REMOVED
				: RemovePhotoResult.NOT_FOUND;
	}

	@Transactional
	public SetCoverResult setCoverPhoto(UUID albumId, UUID photoId) {
		Optional<Album> albumOpt = Album.findByIdOptional(albumId);
		if (albumOpt.isEmpty()) {
			return new SetCoverResult.AlbumNotFound();
		}
		long membership = AlbumPhoto.find("album.id = ?1 and photo.id = ?2", albumId, photoId).count();
		if (membership == 0) {
			return new SetCoverResult.PhotoNotInAlbum();
		}
		Album album = albumOpt.get();
		album.coverPhoto = em.getReference(Photo.class, photoId);
		em.flush();
		return new SetCoverResult.Set(album);
	}

	@Transactional
	public Optional<Album> clearCoverPhoto(UUID albumId) {
		Optional<Album> albumOpt = Album.findByIdOptional(albumId);
		if (albumOpt.isEmpty()) {
			return Optional.empty();
		}
		Album album = albumOpt.get();
		album.coverPhoto = null;
		em.flush();
		return Optional.of(album);
	}

	@Transactional
	public PageResult<Photo> listPhotos(UUID albumId, PageRequest pageRequest) {
		int effectiveSize = pageRequest.effectiveSize(MAX_PAGE_SIZE);
		List<UUID> photoIdsWithLookahead = em.createQuery(
				"SELECT ap.photo.id FROM AlbumPhoto ap WHERE ap.album.id = :albumId ORDER BY ap.addedAt DESC, ap.photo.id DESC",
				UUID.class).setParameter("albumId", albumId).setFirstResult(pageRequest.offset(MAX_PAGE_SIZE))
				.setMaxResults(effectiveSize + 1).getResultList();
		boolean hasNext = photoIdsWithLookahead.size() > effectiveSize;
		List<UUID> photoIds = hasNext ? photoIdsWithLookahead.subList(0, effectiveSize) : photoIdsWithLookahead;

		Long totalItems = null;
		Long totalPages = null;
		if (pageRequest.needsTotal()) {
			totalItems = em.createQuery("SELECT COUNT(ap) FROM AlbumPhoto ap WHERE ap.album.id = :albumId", Long.class)
					.setParameter("albumId", albumId).getSingleResult();
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
			throw new IllegalStateException("Album photos changed during pagination");
		}
		List<Photo> orderedPhotos = photoIds.stream().map(photoId -> {
			Photo photo = photosById.get(photoId);
			if (photo == null) {
				throw new IllegalStateException("Album photos changed during pagination");
			}
			return photo;
		}).toList();
		return new PageResult<>(orderedPhotos, pageRequest.page(), effectiveSize, hasNext, totalItems, totalPages);
	}
}
