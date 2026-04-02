package dev.pina.backend.service;

import dev.pina.backend.domain.Album;
import dev.pina.backend.domain.Favorite;
import dev.pina.backend.domain.FavoriteTargetType;
import dev.pina.backend.domain.Photo;
import dev.pina.backend.domain.User;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.PersistenceException;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@ApplicationScoped
public class FavoriteService {

	@Inject
	SpaceService spaceService;

	public enum AddResult {
		CREATED, ALREADY_EXISTS, TARGET_NOT_FOUND
	}

	@Transactional
	public AddResult add(FavoriteTargetType targetType, UUID targetId, User user) {
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

	public List<Favorite> listByUser(UUID userId, FavoriteTargetType targetType) {
		if (targetType != null) {
			return Favorite.list("user.id = ?1 and targetType = ?2 order by createdAt desc", userId, targetType);
		}
		return Favorite.list("user.id = ?1 order by createdAt desc", userId);
	}

	public boolean isFavorited(UUID userId, FavoriteTargetType targetType, UUID targetId) {
		return Favorite.count("user.id = ?1 and targetType = ?2 and targetId = ?3", userId, targetType, targetId) > 0;
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
		return switch (targetType) {
			case PHOTO -> Photo.<Photo>findByIdOptional(targetId).filter(p -> canAccessPhoto(p, user)).isPresent();
			case ALBUM -> Album.<Album>findByIdOptional(targetId).filter(a -> canAccessAlbum(a, user)).isPresent();
			case VIDEO -> false; // Videos not yet implemented
		};
	}

	private boolean canAccessPhoto(Photo photo, User user) {
		if (photo.uploader.id.equals(user.id)) {
			return true;
		}
		List<UUID> spaceIds = Photo.getEntityManager().createQuery(
				"SELECT DISTINCT ap.album.space.id FROM AlbumPhoto ap WHERE ap.photo.id = :photoId AND ap.album.space IS NOT NULL",
				UUID.class).setParameter("photoId", photo.id).getResultList();
		Set<UUID> accessibleSpaceIds = spaceService.listAccessibleSpaceIds(user.id);
		return spaceIds.stream().anyMatch(accessibleSpaceIds::contains);
	}

	private boolean canAccessAlbum(Album album, User user) {
		if (album.owner.id.equals(user.id)) {
			return true;
		}
		// Space album — check if user is a member of the space
		if (album.space != null) {
			return spaceService.getEffectiveRole(album.space.id, user.id).isPresent();
		}
		return false;
	}
}
