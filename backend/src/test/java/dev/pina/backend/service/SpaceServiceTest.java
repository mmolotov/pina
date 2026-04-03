package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.pina.backend.TestUserHelper;
import dev.pina.backend.domain.Album;
import dev.pina.backend.domain.FavoriteTargetType;
import dev.pina.backend.domain.Space;
import dev.pina.backend.domain.SpaceRole;
import dev.pina.backend.domain.SpaceVisibility;
import dev.pina.backend.domain.User;
import dev.pina.backend.pagination.PageRequest;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.Optional;
import org.junit.jupiter.api.Test;

@QuarkusTest
class SpaceServiceTest {

	private static final PageRequest ALL = new PageRequest(0, 100, false);

	@Inject
	SpaceService spaceService;

	@Inject
	FavoriteService favoriteService;

	@Test
	@Transactional
	void createSpaceAssignsOwnerMembership() {
		User user = TestUserHelper.createUser("space-create");
		Space space = spaceService.create("My Space", "A description", SpaceVisibility.PRIVATE, user);

		assertNotNull(space.id);
		assertEquals("My Space", space.name);
		assertEquals(0, space.depth);

		Optional<SpaceRole> role = spaceService.getUserRole(space.id, user.id);
		assertTrue(role.isPresent());
		assertEquals(SpaceRole.OWNER, role.get());
	}

	@Test
	@Transactional
	void createSpaceDefaultsToPrivate() {
		User user = TestUserHelper.createUser("space-default-vis");
		Space space = spaceService.create("Default Vis", null, null, user);
		assertEquals(SpaceVisibility.PRIVATE, space.visibility);
	}

	@Test
	@Transactional
	void listByUserReturnsOnlyMemberSpaces() {
		User user1 = TestUserHelper.createUser("space-list-u1");
		User user2 = TestUserHelper.createUser("space-list-u2");
		spaceService.create("User1 Space", null, null, user1);
		spaceService.create("User2 Space", null, null, user2);

		var user1Spaces = spaceService.listByUser(user1.id);
		assertTrue(user1Spaces.stream().allMatch(s -> s.name.equals("User1 Space")));
	}

	@Test
	@Transactional
	void listByUserIncludesInheritedSubspaces() {
		User owner = TestUserHelper.createUser("space-list-inherit-owner");
		User member = TestUserHelper.createUser("space-list-inherit-member");
		Space parent = spaceService.create("Inherited Parent", null, null, owner);
		Space child = spaceService.createSubspace(parent.id, "Inherited Child", null, null, owner);
		spaceService.addMember(parent.id, member.id, SpaceRole.MEMBER);

		var spaces = spaceService.listByUser(member.id);

		assertTrue(spaces.stream().anyMatch(s -> s.id.equals(parent.id)));
		assertTrue(spaces.stream().anyMatch(s -> s.id.equals(child.id)));
	}

	@Test
	@Transactional
	void updateSpaceChangesFields() {
		User user = TestUserHelper.createUser("space-update");
		Space space = spaceService.create("Original", "Old desc", SpaceVisibility.PRIVATE, user);

		var updated = spaceService.update(space.id, "Renamed", "New desc", SpaceVisibility.PUBLIC, null);
		assertTrue(updated.isPresent());
		assertEquals("Renamed", updated.get().name);
		assertEquals(SpaceVisibility.PUBLIC, updated.get().visibility);
	}

	@Test
	@Transactional
	void deleteSpaceRemovesIt() {
		User user = TestUserHelper.createUser("space-delete");
		Space space = spaceService.create("To Delete", null, null, user);

		assertTrue(spaceService.delete(space.id));
		assertTrue(spaceService.findById(space.id).isEmpty());
	}

	@Test
	@Transactional
	void createSubspaceIncrementsDepth() {
		User user = TestUserHelper.createUser("space-sub");
		Space parent = spaceService.create("Parent", null, null, user);
		Space child = spaceService.createSubspace(parent.id, "Child", null, null, user);

		assertEquals(1, child.depth);
		assertEquals(parent.id, child.parent.id);
	}

	@Test
	@Transactional
	void createSubspaceAtMaxDepthThrows() {
		User user = TestUserHelper.createUser("space-max-depth");
		Space s = spaceService.create("Level 0", null, null, user);
		for (int i = 1; i <= 5; i++) {
			s = spaceService.createSubspace(s.id, "Level " + i, null, null, user);
		}
		Space deepest = s;
		assertThrows(IllegalArgumentException.class,
				() -> spaceService.createSubspace(deepest.id, "Too Deep", null, null, user));
	}

	@Test
	@Transactional
	void listSubspacesReturnsChildren() {
		User user = TestUserHelper.createUser("space-list-sub");
		Space parent = spaceService.create("Parent", null, null, user);
		spaceService.createSubspace(parent.id, "Child A", null, null, user);
		spaceService.createSubspace(parent.id, "Child B", null, null, user);

		var children = spaceService.listSubspaces(parent.id);
		assertEquals(2, children.size());
	}

	@Test
	@Transactional
	void addMemberAndListMembers() {
		User owner = TestUserHelper.createUser("space-mbr-owner");
		User member = TestUserHelper.createUser("space-mbr-user");
		Space space = spaceService.create("Members Space", null, null, owner);

		var result = spaceService.addMember(space.id, member.id, SpaceRole.MEMBER);
		assertEquals(SpaceService.AddMemberResult.CREATED, result);

		var members = spaceService.listMembers(space.id, ALL).items();
		assertEquals(2, members.size());
	}

	@Test
	@Transactional
	void addMemberWithOwnerRoleThrows() {
		User owner = TestUserHelper.createUser("space-mbr-own-reject");
		User user2 = TestUserHelper.createUser("space-mbr-own-reject2");
		Space space = spaceService.create("No Owner Add", null, null, owner);

		assertThrows(IllegalArgumentException.class, () -> spaceService.addMember(space.id, user2.id, SpaceRole.OWNER));
	}

	@Test
	@Transactional
	void addDuplicateMemberReturnsAlreadyExists() {
		User owner = TestUserHelper.createUser("space-mbr-dup-owner");
		User member = TestUserHelper.createUser("space-mbr-dup-user");
		Space space = spaceService.create("Dup Space", null, null, owner);

		spaceService.addMember(space.id, member.id, SpaceRole.MEMBER);
		var result = spaceService.addMember(space.id, member.id, SpaceRole.VIEWER);
		assertEquals(SpaceService.AddMemberResult.ALREADY_EXISTS, result);
	}

	@Test
	@Transactional
	void changeRoleUpdatesRole() {
		User owner = TestUserHelper.createUser("space-role-owner");
		User member = TestUserHelper.createUser("space-role-user");
		Space space = spaceService.create("Role Space", null, null, owner);
		spaceService.addMember(space.id, member.id, SpaceRole.MEMBER);

		var updated = spaceService.changeRole(space.id, owner.id, member.id, SpaceRole.ADMIN);
		assertTrue(updated.isPresent());
		assertEquals(SpaceRole.ADMIN, updated.get().role);
	}

	@Test
	@Transactional
	void changeRoleToOwnerThrows() {
		User owner = TestUserHelper.createUser("space-role-to-own");
		User member = TestUserHelper.createUser("space-role-to-own2");
		Space space = spaceService.create("Owner Role", null, null, owner);
		spaceService.addMember(space.id, member.id, SpaceRole.MEMBER);

		assertThrows(IllegalArgumentException.class,
				() -> spaceService.changeRole(space.id, owner.id, member.id, SpaceRole.OWNER));
	}

	@Test
	@Transactional
	void changeOwnerRoleThrows() {
		User owner = TestUserHelper.createUser("space-role-own-change");
		Space space = spaceService.create("Cant Change Owner", null, null, owner);

		assertThrows(IllegalArgumentException.class,
				() -> spaceService.changeRole(space.id, owner.id, owner.id, SpaceRole.ADMIN));
	}

	@Test
	@Transactional
	void adminCannotChangeAdminRole() {
		User owner = TestUserHelper.createUser("space-admin-vs-admin-o");
		User admin = TestUserHelper.createUser("space-admin-vs-admin-a");
		User admin2 = TestUserHelper.createUser("space-admin-vs-admin-a2");
		Space space = spaceService.create("Admin vs Admin", null, null, owner);
		spaceService.addMember(space.id, admin.id, SpaceRole.ADMIN);
		spaceService.addMember(space.id, admin2.id, SpaceRole.ADMIN);

		var result = spaceService.changeRole(space.id, admin.id, admin2.id, SpaceRole.MEMBER);
		assertTrue(result.isEmpty());
	}

	@Test
	@Transactional
	void adminCannotPromoteToAdmin() {
		User owner = TestUserHelper.createUser("space-admin-promo-o");
		User admin = TestUserHelper.createUser("space-admin-promo-a");
		User member = TestUserHelper.createUser("space-admin-promo-m");
		Space space = spaceService.create("No Promo", null, null, owner);
		spaceService.addMember(space.id, admin.id, SpaceRole.ADMIN);
		spaceService.addMember(space.id, member.id, SpaceRole.MEMBER);

		assertThrows(IllegalArgumentException.class,
				() -> spaceService.changeRole(space.id, admin.id, member.id, SpaceRole.ADMIN));
	}

	@Test
	@Transactional
	void inheritedAdminCanChangeDirectChildMembership() {
		User owner = TestUserHelper.createUser("space-inherit-role-owner");
		User admin = TestUserHelper.createUser("space-inherit-role-admin");
		User member = TestUserHelper.createUser("space-inherit-role-member");
		Space parent = spaceService.create("Inherited Parent", null, null, owner);
		Space child = spaceService.createSubspace(parent.id, "Inherited Child", null, null, owner);
		spaceService.addMember(parent.id, admin.id, SpaceRole.ADMIN);
		spaceService.addMember(child.id, member.id, SpaceRole.MEMBER);

		var updated = spaceService.changeRole(child.id, admin.id, member.id, SpaceRole.VIEWER);
		assertTrue(updated.isPresent());
		assertEquals(SpaceRole.VIEWER, updated.get().role);
	}

	@Test
	@Transactional
	void removeMemberByOwnerSucceeds() {
		User owner = TestUserHelper.createUser("space-rm-owner");
		User member = TestUserHelper.createUser("space-rm-user");
		Space space = spaceService.create("Remove Space", null, null, owner);
		spaceService.addMember(space.id, member.id, SpaceRole.MEMBER);

		var result = spaceService.removeMember(space.id, owner.id, member.id);
		assertEquals(SpaceService.RemoveMemberResult.REMOVED, result);
	}

	@Test
	@Transactional
	void removeOwnerReturnsIsOwner() {
		User owner = TestUserHelper.createUser("space-rm-own");
		Space space = spaceService.create("No Remove Owner", null, null, owner);

		var result = spaceService.removeMember(space.id, owner.id, owner.id);
		assertEquals(SpaceService.RemoveMemberResult.IS_OWNER, result);
	}

	@Test
	@Transactional
	void selfLeaveSucceeds() {
		User owner = TestUserHelper.createUser("space-self-leave-o");
		User member = TestUserHelper.createUser("space-self-leave-m");
		Space space = spaceService.create("Self Leave", null, null, owner);
		spaceService.addMember(space.id, member.id, SpaceRole.MEMBER);

		var result = spaceService.removeMember(space.id, member.id, member.id);
		assertEquals(SpaceService.RemoveMemberResult.REMOVED, result);
	}

	@Test
	@Transactional
	void adminCannotRemoveAnotherAdmin() {
		User owner = TestUserHelper.createUser("space-admin-rm-o");
		User admin1 = TestUserHelper.createUser("space-admin-rm-a1");
		User admin2 = TestUserHelper.createUser("space-admin-rm-a2");
		Space space = spaceService.create("Admin Rm", null, null, owner);
		spaceService.addMember(space.id, admin1.id, SpaceRole.ADMIN);
		spaceService.addMember(space.id, admin2.id, SpaceRole.ADMIN);

		var result = spaceService.removeMember(space.id, admin1.id, admin2.id);
		assertEquals(SpaceService.RemoveMemberResult.FORBIDDEN, result);
	}

	@Test
	@Transactional
	void inheritedAdminCanRemoveDirectChildMember() {
		User owner = TestUserHelper.createUser("space-inherit-rm-owner");
		User admin = TestUserHelper.createUser("space-inherit-rm-admin");
		User member = TestUserHelper.createUser("space-inherit-rm-member");
		Space parent = spaceService.create("Inherited Remove Parent", null, null, owner);
		Space child = spaceService.createSubspace(parent.id, "Inherited Remove Child", null, null, owner);
		spaceService.addMember(parent.id, admin.id, SpaceRole.ADMIN);
		spaceService.addMember(child.id, member.id, SpaceRole.MEMBER);

		var result = spaceService.removeMember(child.id, admin.id, member.id);
		assertEquals(SpaceService.RemoveMemberResult.REMOVED, result);
	}

	@Test
	@Transactional
	void memberCannotRemoveOther() {
		User owner = TestUserHelper.createUser("space-mbr-rm-o");
		User member1 = TestUserHelper.createUser("space-mbr-rm-m1");
		User member2 = TestUserHelper.createUser("space-mbr-rm-m2");
		Space space = spaceService.create("Mbr Rm", null, null, owner);
		spaceService.addMember(space.id, member1.id, SpaceRole.MEMBER);
		spaceService.addMember(space.id, member2.id, SpaceRole.MEMBER);

		var result = spaceService.removeMember(space.id, member1.id, member2.id);
		assertEquals(SpaceService.RemoveMemberResult.FORBIDDEN, result);
	}

	@Test
	@Transactional
	void deleteSpaceRemovesFavoritesForSpaceAlbums() {
		User owner = TestUserHelper.createUser("space-delete-fav-owner");
		User member = TestUserHelper.createUser("space-delete-fav-member");
		Space space = spaceService.create("Delete Fav Space", null, null, owner);
		spaceService.addMember(space.id, member.id, SpaceRole.VIEWER);

		Album album = new Album();
		album.name = "Delete Fav Album";
		album.owner = owner;
		album.space = space;
		album.persistAndFlush();

		assertEquals(FavoriteService.AddResult.CREATED,
				favoriteService.add(FavoriteTargetType.ALBUM, album.id, member));

		assertTrue(spaceService.delete(space.id));
		assertTrue(favoriteService.listByUser(member.id, FavoriteTargetType.ALBUM, ALL).items().isEmpty());
	}
}
