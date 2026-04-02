package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.pina.backend.TestUserHelper;
import dev.pina.backend.domain.Album;
import dev.pina.backend.domain.AlbumPhoto;
import dev.pina.backend.domain.FavoriteTargetType;
import dev.pina.backend.domain.PersonalLibrary;
import dev.pina.backend.domain.Photo;
import dev.pina.backend.domain.SpaceRole;
import dev.pina.backend.domain.SpaceVisibility;
import dev.pina.backend.domain.User;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

@QuarkusTest
class FavoriteServiceTest {

	@Inject
	FavoriteService favoriteService;

	@Inject
	SpaceService spaceService;

	@Test
	@Transactional
	void addPhotoFavorite() {
		var user = TestUserHelper.createUser("fav-add");
		var photo = createPhoto(user);
		assertEquals(FavoriteService.AddResult.CREATED, favoriteService.add(FavoriteTargetType.PHOTO, photo.id, user));
	}

	@Test
	@Transactional
	void addDuplicateFavoriteReturnsAlreadyExists() {
		var user = TestUserHelper.createUser("fav-dup");
		var photo = createPhoto(user);
		favoriteService.add(FavoriteTargetType.PHOTO, photo.id, user);
		assertEquals(FavoriteService.AddResult.ALREADY_EXISTS,
				favoriteService.add(FavoriteTargetType.PHOTO, photo.id, user));
	}

	@Test
	@Transactional
	void addFavoriteForNonexistentTargetReturnsNotFound() {
		var user = TestUserHelper.createUser("fav-notfound");
		assertEquals(FavoriteService.AddResult.TARGET_NOT_FOUND,
				favoriteService.add(FavoriteTargetType.PHOTO, UUID.randomUUID(), user));
	}

	@Test
	@Transactional
	void addFavoriteForOtherUsersPhotoReturnsNotFound() {
		var user1 = TestUserHelper.createUser("fav-owner");
		var user2 = TestUserHelper.createUser("fav-other");
		var photo = createPhoto(user1);
		assertEquals(FavoriteService.AddResult.TARGET_NOT_FOUND,
				favoriteService.add(FavoriteTargetType.PHOTO, photo.id, user2));
	}

	@Test
	@Transactional
	void removeFavorite() {
		var user = TestUserHelper.createUser("fav-rm");
		var photo = createPhoto(user);
		favoriteService.add(FavoriteTargetType.PHOTO, photo.id, user);
		var favorites = favoriteService.listByUser(user.id, null);
		assertEquals(1, favorites.size());
		assertTrue(favoriteService.remove(favorites.getFirst().id, user.id));
		assertTrue(favoriteService.listByUser(user.id, null).isEmpty());
	}

	@Test
	@Transactional
	void removeNonexistentFavoriteReturnsFalse() {
		var user = TestUserHelper.createUser("fav-rm-ne");
		assertFalse(favoriteService.remove(UUID.randomUUID(), user.id));
	}

	@Test
	@Transactional
	void removeOtherUsersFavoriteReturnsFalse() {
		var user1 = TestUserHelper.createUser("fav-rm-o1");
		var user2 = TestUserHelper.createUser("fav-rm-o2");
		var photo = createPhoto(user1);
		favoriteService.add(FavoriteTargetType.PHOTO, photo.id, user1);
		var favorites = favoriteService.listByUser(user1.id, null);
		assertFalse(favoriteService.remove(favorites.getFirst().id, user2.id));
	}

	@Test
	@Transactional
	void listByUserFiltersByType() {
		var user = TestUserHelper.createUser("fav-filter");
		var photo = createPhoto(user);
		var album = createAlbum(user);
		favoriteService.add(FavoriteTargetType.PHOTO, photo.id, user);
		favoriteService.add(FavoriteTargetType.ALBUM, album.id, user);

		assertEquals(2, favoriteService.listByUser(user.id, null).size());
		assertEquals(1, favoriteService.listByUser(user.id, FavoriteTargetType.PHOTO).size());
		assertEquals(1, favoriteService.listByUser(user.id, FavoriteTargetType.ALBUM).size());
		assertEquals(0, favoriteService.listByUser(user.id, FavoriteTargetType.VIDEO).size());
	}

	@Test
	@Transactional
	void isFavorited() {
		var user = TestUserHelper.createUser("fav-check");
		var photo = createPhoto(user);
		assertFalse(favoriteService.isFavorited(user.id, FavoriteTargetType.PHOTO, photo.id));
		favoriteService.add(FavoriteTargetType.PHOTO, photo.id, user);
		assertTrue(favoriteService.isFavorited(user.id, FavoriteTargetType.PHOTO, photo.id));
	}

	@Test
	@Transactional
	void addAlbumFavorite() {
		var user = TestUserHelper.createUser("fav-album");
		var album = createAlbum(user);
		assertEquals(FavoriteService.AddResult.CREATED, favoriteService.add(FavoriteTargetType.ALBUM, album.id, user));
	}

	@Test
	@Transactional
	void canFavoritePhotoInSpaceAlbum() {
		var owner = TestUserHelper.createUser("fav-space-owner");
		var member = TestUserHelper.createUser("fav-space-member");
		var space = spaceService.create("Fav Space", null, SpaceVisibility.PRIVATE, owner);
		spaceService.addMember(space.id, member.id, SpaceRole.MEMBER);

		var photo = createPhoto(owner);
		Album spaceAlbum = new Album();
		spaceAlbum.name = "Space Album";
		spaceAlbum.owner = owner;
		spaceAlbum.space = space;
		spaceAlbum.persistAndFlush();

		AlbumPhoto ap = new AlbumPhoto();
		ap.album = spaceAlbum;
		ap.photo = photo;
		ap.addedBy = owner;
		ap.persistAndFlush();

		// Member can favorite a photo in a space album they belong to
		assertEquals(FavoriteService.AddResult.CREATED,
				favoriteService.add(FavoriteTargetType.PHOTO, photo.id, member));
	}

	@Test
	@Transactional
	void canFavoriteSpaceAlbum() {
		var owner = TestUserHelper.createUser("fav-sp-album-owner");
		var member = TestUserHelper.createUser("fav-sp-album-member");
		var space = spaceService.create("Fav Album Space", null, SpaceVisibility.PRIVATE, owner);
		spaceService.addMember(space.id, member.id, SpaceRole.VIEWER);

		Album spaceAlbum = new Album();
		spaceAlbum.name = "Shared Album";
		spaceAlbum.owner = owner;
		spaceAlbum.space = space;
		spaceAlbum.persistAndFlush();

		// Member can favorite a space album they have access to
		assertEquals(FavoriteService.AddResult.CREATED,
				favoriteService.add(FavoriteTargetType.ALBUM, spaceAlbum.id, member));
	}

	@Test
	@Transactional
	void canFavoritePhotoInInheritedSubspaceAlbum() {
		var owner = TestUserHelper.createUser("fav-subspace-owner");
		var member = TestUserHelper.createUser("fav-subspace-member");
		var parent = spaceService.create("Parent Space", null, SpaceVisibility.PRIVATE, owner);
		var child = spaceService.createSubspace(parent.id, "Child Space", null, SpaceVisibility.PRIVATE, owner);
		spaceService.addMember(parent.id, member.id, SpaceRole.MEMBER);

		var photo = createPhoto(owner);
		Album childAlbum = new Album();
		childAlbum.name = "Child Album";
		childAlbum.owner = owner;
		childAlbum.space = child;
		childAlbum.persistAndFlush();

		AlbumPhoto ap = new AlbumPhoto();
		ap.album = childAlbum;
		ap.photo = photo;
		ap.addedBy = owner;
		ap.persistAndFlush();

		assertEquals(FavoriteService.AddResult.CREATED,
				favoriteService.add(FavoriteTargetType.PHOTO, photo.id, member));
	}

	@Test
	@Transactional
	void addVideoFavoriteReturnsNotFound() {
		var user = TestUserHelper.createUser("fav-video");
		assertEquals(FavoriteService.AddResult.TARGET_NOT_FOUND,
				favoriteService.add(FavoriteTargetType.VIDEO, UUID.randomUUID(), user));
	}

	@Test
	@Transactional
	void removeForTargetDeletesAllMatchingFavorites() {
		var owner = TestUserHelper.createUser("fav-clean-owner");
		var other = TestUserHelper.createUser("fav-clean-other");
		var photo = createPhoto(owner);

		favoriteService.add(FavoriteTargetType.PHOTO, photo.id, owner);
		var space = spaceService.create("Cleanup Space", null, SpaceVisibility.PRIVATE, owner);
		spaceService.addMember(space.id, other.id, SpaceRole.MEMBER);

		Album spaceAlbum = new Album();
		spaceAlbum.name = "Cleanup Album";
		spaceAlbum.owner = owner;
		spaceAlbum.space = space;
		spaceAlbum.persistAndFlush();

		AlbumPhoto ap = new AlbumPhoto();
		ap.album = spaceAlbum;
		ap.photo = photo;
		ap.addedBy = owner;
		ap.persistAndFlush();

		favoriteService.add(FavoriteTargetType.PHOTO, photo.id, other);

		assertEquals(2, favoriteService.removeForTarget(FavoriteTargetType.PHOTO, photo.id));
		assertFalse(favoriteService.isFavorited(owner.id, FavoriteTargetType.PHOTO, photo.id));
		assertFalse(favoriteService.isFavorited(other.id, FavoriteTargetType.PHOTO, photo.id));
	}

	private Photo createPhoto(User user) {
		PersonalLibrary lib = PersonalLibrary.find("owner.id", user.id).firstResult();
		Photo photo = new Photo();
		photo.uploader = user;
		photo.personalLibrary = lib;
		photo.contentHash = UUID.randomUUID().toString().replace("-", "")
				+ UUID.randomUUID().toString().replace("-", "");
		photo.originalFilename = "test.jpg";
		photo.mimeType = "image/jpeg";
		photo.width = 100;
		photo.height = 100;
		photo.sizeBytes = 1024L;
		photo.persistAndFlush();
		return photo;
	}

	private Album createAlbum(User user) {
		PersonalLibrary lib = PersonalLibrary.find("owner.id", user.id).firstResult();
		Album album = new Album();
		album.name = "Test Album";
		album.owner = user;
		album.personalLibrary = lib;
		album.persistAndFlush();
		return album;
	}
}
