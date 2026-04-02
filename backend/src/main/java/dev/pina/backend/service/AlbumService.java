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
import jakarta.persistence.PersistenceException;
import jakarta.transaction.Transactional;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class AlbumService {

	private static final int MAX_PAGE_SIZE = 100;

	public enum AddPhotoResult {
		CREATED, ALREADY_EXISTS, NOT_FOUND, PHOTO_NOT_ACCESSIBLE
	}

	public enum RemovePhotoResult {
		REMOVED, NOT_FOUND, FORBIDDEN
	}

	@Inject
	EntityManager em;

	@Inject
	PersonalLibraryService personalLibraryService;

	@Inject
	FavoriteService favoriteService;

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
		Optional<Album> album = Album.findByIdOptional(id);
		if (album.isEmpty()) {
			return false;
		}
		favoriteService.removeForTarget(FavoriteTargetType.ALBUM, id);
		AlbumPhoto.delete("album.id", id);
		album.get().delete();
		return true;
	}

	public List<Album> listByOwner(UUID ownerId) {
		return Album.list("personalLibrary.owner.id", ownerId);
	}

	public List<Album> listBySpace(UUID spaceId) {
		return Album.list("space.id = ?1 order by createdAt desc", spaceId);
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
		Optional<AlbumPhoto> albumPhoto = AlbumPhoto.getEntityManager().createQuery(
				"SELECT ap FROM AlbumPhoto ap JOIN FETCH ap.photo p JOIN FETCH p.uploader WHERE ap.album.id = :albumId AND ap.photo.id = :photoId",
				AlbumPhoto.class).setParameter("albumId", albumId).setParameter("photoId", photoId).getResultStream()
				.findFirst();
		if (albumPhoto.isEmpty()) {
			return RemovePhotoResult.NOT_FOUND;
		}

		if (!canManageAlbum && !albumPhoto.get().photo.uploader.id.equals(actingUser.id)) {
			return RemovePhotoResult.FORBIDDEN;
		}

		albumPhoto.get().delete();
		return RemovePhotoResult.REMOVED;
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
