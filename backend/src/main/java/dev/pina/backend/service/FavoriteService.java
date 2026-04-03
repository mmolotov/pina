package dev.pina.backend.service;

import dev.pina.backend.domain.Album;
import dev.pina.backend.domain.Favorite;
import dev.pina.backend.domain.FavoriteTargetType;
import dev.pina.backend.domain.User;
import dev.pina.backend.pagination.PageRequest;
import dev.pina.backend.pagination.PageResult;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@ApplicationScoped
public class FavoriteService {

	private static final int MAX_PAGE_SIZE = 100;
	private static final String FAVORITE_PHOTO_LOCK_NAMESPACE = "favorite-target-photo";
	private static final String FAVORITE_ALBUM_LOCK_NAMESPACE = "favorite-target-album";

	@Inject
	SpaceService spaceService;

	@Inject
	EntityManager em;

	@Inject
	TransactionalLockService lockService;

	public enum AddResult {
		CREATED, ALREADY_EXISTS, TARGET_NOT_FOUND
	}

	@Transactional
	public AddResult add(FavoriteTargetType targetType, UUID targetId, User user) {
		lockTarget(targetType, targetId);
		if (!targetExists(targetType, targetId, user)) {
			return AddResult.TARGET_NOT_FOUND;
		}

		Optional<Favorite> existing = Favorite
				.find("user.id = ?1 and targetType = ?2 and targetId = ?3", user.id, targetType, targetId)
				.firstResultOptional();
		if (existing.isPresent()) {
			return AddResult.ALREADY_EXISTS;
		}

		try {
			Favorite favorite = new Favorite();
			favorite.user = user;
			favorite.targetType = targetType;
			favorite.targetId = targetId;
			favorite.persistAndFlush();
		} catch (PersistenceException _) {
			Favorite.getEntityManager().clear();
			return AddResult.ALREADY_EXISTS;
		}
		return AddResult.CREATED;
	}

	@Transactional
	public boolean remove(UUID favoriteId, UUID userId) {
		return Favorite.<Favorite>findByIdOptional(favoriteId).filter(f -> f.user.id.equals(userId)).map(f -> {
			f.delete();
			return true;
		}).orElse(false);
	}

	public PageResult<Favorite> listByUser(UUID userId, FavoriteTargetType targetType, PageRequest pageRequest) {
		int effectiveSize = pageRequest.effectiveSize(MAX_PAGE_SIZE);
		List<Favorite> favorites;
		if (targetType != null) {
			favorites = em.createQuery(
					"SELECT f FROM Favorite f JOIN FETCH f.user WHERE f.user.id = :userId AND f.targetType = :targetType ORDER BY f.createdAt DESC",
					Favorite.class).setParameter("userId", userId).setParameter("targetType", targetType)
					.setFirstResult(pageRequest.offset(MAX_PAGE_SIZE)).setMaxResults(effectiveSize + 1).getResultList();
		} else {
			favorites = em.createQuery(
					"SELECT f FROM Favorite f JOIN FETCH f.user WHERE f.user.id = :userId ORDER BY f.createdAt DESC",
					Favorite.class).setParameter("userId", userId).setFirstResult(pageRequest.offset(MAX_PAGE_SIZE))
					.setMaxResults(effectiveSize + 1).getResultList();
		}
		boolean hasNext = favorites.size() > effectiveSize;
		List<Favorite> page = hasNext ? favorites.subList(0, effectiveSize) : favorites;
		List<Favorite> filtered = page.isEmpty() ? page : filterAccessibleFavorites(userId, page);
		Long totalItems = null;
		Long totalPages = null;
		if (pageRequest.needsTotal()) {
			if (targetType != null) {
				totalItems = em.createQuery(
						"SELECT COUNT(f) FROM Favorite f WHERE f.user.id = :userId AND f.targetType = :targetType",
						Long.class).setParameter("userId", userId).setParameter("targetType", targetType)
						.getSingleResult();
			} else {
				totalItems = em.createQuery("SELECT COUNT(f) FROM Favorite f WHERE f.user.id = :userId", Long.class)
						.setParameter("userId", userId).getSingleResult();
			}
			totalPages = PageResult.totalPages(totalItems, effectiveSize);
		}
		return new PageResult<>(filtered, pageRequest.page(), effectiveSize, hasNext, totalItems, totalPages);
	}

	public boolean isFavorited(UUID userId, FavoriteTargetType targetType, UUID targetId) {
		if (Favorite.count("user.id = ?1 and targetType = ?2 and targetId = ?3", userId, targetType, targetId) == 0) {
			return false;
		}
		Set<UUID> accessibleSpaceIds = spaceService.listAccessibleSpaceIds(userId);
		return switch (targetType) {
			case PHOTO -> loadAccessiblePhotoIds(userId, Set.of(targetId), accessibleSpaceIds).contains(targetId);
			case ALBUM -> loadAccessibleAlbumIds(userId, Set.of(targetId), accessibleSpaceIds).contains(targetId);
			case VIDEO -> false;
		};
	}

	@Transactional
	public long removeForTarget(FavoriteTargetType targetType, UUID targetId) {
		return Favorite.delete("targetType = ?1 and targetId = ?2", targetType, targetId);
	}

	@Transactional
	public long removeForTargets(FavoriteTargetType targetType, List<UUID> targetIds) {
		if (targetIds.isEmpty()) {
			return 0;
		}
		return Favorite.delete("targetType = ?1 and targetId in ?2", targetType, targetIds);
	}

	private boolean targetExists(FavoriteTargetType targetType, UUID targetId, User user) {
		Set<UUID> accessibleSpaceIds = spaceService.listAccessibleSpaceIds(user.id);
		return switch (targetType) {
			case PHOTO -> loadAccessiblePhotoIds(user.id, Set.of(targetId), accessibleSpaceIds).contains(targetId);
			case ALBUM -> loadAccessibleAlbumIds(user.id, Set.of(targetId), accessibleSpaceIds).contains(targetId);
			case VIDEO -> false; // Videos not yet implemented
		};
	}

	private void lockTarget(FavoriteTargetType targetType, UUID targetId) {
		switch (targetType) {
			case PHOTO -> lockService.lock(FAVORITE_PHOTO_LOCK_NAMESPACE, targetId);
			case ALBUM -> lockService.lock(FAVORITE_ALBUM_LOCK_NAMESPACE, targetId);
			case VIDEO -> {
			}
		}
	}

	private List<Favorite> filterAccessibleFavorites(UUID userId, List<Favorite> favorites) {
		Set<UUID> accessibleSpaceIds = spaceService.listAccessibleSpaceIds(userId);
		Set<UUID> photoIds = favoriteTargetIds(favorites, FavoriteTargetType.PHOTO);
		Set<UUID> albumIds = favoriteTargetIds(favorites, FavoriteTargetType.ALBUM);
		Set<UUID> accessiblePhotoIds = loadAccessiblePhotoIds(userId, photoIds, accessibleSpaceIds);
		Set<UUID> accessibleAlbumIds = loadAccessibleAlbumIds(userId, albumIds, accessibleSpaceIds);
		return favorites.stream().filter(favorite -> switch (favorite.targetType) {
			case PHOTO -> accessiblePhotoIds.contains(favorite.targetId);
			case ALBUM -> accessibleAlbumIds.contains(favorite.targetId);
			case VIDEO -> false;
		}).toList();
	}

	private Set<UUID> favoriteTargetIds(List<Favorite> favorites, FavoriteTargetType targetType) {
		return favorites.stream().filter(favorite -> favorite.targetType == targetType)
				.map(favorite -> favorite.targetId).collect(Collectors.toSet());
	}

	private Set<UUID> loadAccessiblePhotoIds(UUID userId, Set<UUID> photoIds, Set<UUID> accessibleSpaceIds) {
		if (photoIds.isEmpty()) {
			return Set.of();
		}
		Set<UUID> accessiblePhotoIds = Favorite.getEntityManager()
				.createQuery("SELECT p.id FROM Photo p WHERE p.id IN :photoIds AND p.uploader.id = :userId", UUID.class)
				.setParameter("photoIds", photoIds).setParameter("userId", userId).getResultStream()
				.collect(Collectors.toSet());
		if (!accessibleSpaceIds.isEmpty()) {
			accessiblePhotoIds.addAll(Favorite.getEntityManager().createQuery(
					"SELECT DISTINCT ap.photo.id FROM AlbumPhoto ap WHERE ap.photo.id IN :photoIds AND ap.album.space.id IN :spaceIds",
					UUID.class).setParameter("photoIds", photoIds).setParameter("spaceIds", accessibleSpaceIds)
					.getResultStream().collect(Collectors.toSet()));
		}
		return accessiblePhotoIds;
	}

	private Set<UUID> loadAccessibleAlbumIds(UUID userId, Set<UUID> albumIds, Set<UUID> accessibleSpaceIds) {
		if (albumIds.isEmpty()) {
			return Set.of();
		}
		Set<UUID> accessibleAlbumIds = Album.getEntityManager()
				.createQuery(
						"SELECT a.id FROM Album a WHERE a.id IN :albumIds AND a.owner.id = :userId AND a.space IS NULL",
						UUID.class)
				.setParameter("albumIds", albumIds).setParameter("userId", userId).getResultStream()
				.collect(Collectors.toSet());
		if (!accessibleSpaceIds.isEmpty()) {
			accessibleAlbumIds.addAll(Album.getEntityManager()
					.createQuery("SELECT a.id FROM Album a WHERE a.id IN :albumIds AND a.space.id IN :spaceIds",
							UUID.class)
					.setParameter("albumIds", albumIds).setParameter("spaceIds", accessibleSpaceIds).getResultStream()
					.collect(Collectors.toSet()));
		}
		return accessibleAlbumIds;
	}
}
