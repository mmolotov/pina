package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.pina.backend.TestUserHelper;
import dev.pina.backend.domain.SpaceRole;
import dev.pina.backend.domain.SpaceVisibility;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.Test;

@QuarkusTest
class SpaceServiceInheritanceTest {

	@Inject
	SpaceService spaceService;

	@Test
	@Transactional
	void directMembershipReturnsRole() {
		var user = TestUserHelper.createUser("inherit-direct");
		var space = spaceService.create("Direct Space", null, SpaceVisibility.PRIVATE, user);

		var role = spaceService.getEffectiveRole(space.id, user.id);
		assertTrue(role.isPresent());
		assertEquals(SpaceRole.OWNER, role.get());
	}

	@Test
	@Transactional
	void inheritedRoleFromParent() {
		var user = TestUserHelper.createUser("inherit-parent");
		var parent = spaceService.create("Parent", null, SpaceVisibility.PRIVATE, user);
		var child = spaceService.createSubspace(parent.id, "Child", null, SpaceVisibility.PRIVATE, user);

		var otherUser = TestUserHelper.createUser("inherit-other");
		spaceService.addMember(parent.id, otherUser.id, SpaceRole.MEMBER);

		// No direct membership in child — should inherit MEMBER from parent
		var role = spaceService.getEffectiveRole(child.id, otherUser.id);
		assertTrue(role.isPresent());
		assertEquals(SpaceRole.MEMBER, role.get());
	}

	@Test
	@Transactional
	void directMembershipOverridesInherited() {
		var user = TestUserHelper.createUser("inherit-override");
		var parent = spaceService.create("Override Parent", null, SpaceVisibility.PRIVATE, user);
		var child = spaceService.createSubspace(parent.id, "Override Child", null, SpaceVisibility.PRIVATE, user);

		var otherUser = TestUserHelper.createUser("inherit-override-other");
		spaceService.addMember(parent.id, otherUser.id, SpaceRole.ADMIN);
		spaceService.addMember(child.id, otherUser.id, SpaceRole.VIEWER);

		// Direct membership in child overrides parent's ADMIN
		var role = spaceService.getEffectiveRole(child.id, otherUser.id);
		assertTrue(role.isPresent());
		assertEquals(SpaceRole.VIEWER, role.get());
	}

	@Test
	@Transactional
	void inheritedRoleTwoLevelsDeep() {
		var user = TestUserHelper.createUser("inherit-2lvl");
		var grandparent = spaceService.create("Grandparent", null, SpaceVisibility.PRIVATE, user);
		var parent = spaceService.createSubspace(grandparent.id, "Parent", null, SpaceVisibility.PRIVATE, user);
		var child = spaceService.createSubspace(parent.id, "Child", null, SpaceVisibility.PRIVATE, user);

		var otherUser = TestUserHelper.createUser("inherit-2lvl-other");
		spaceService.addMember(grandparent.id, otherUser.id, SpaceRole.MEMBER);

		// Should walk up two levels to find grandparent membership
		var role = spaceService.getEffectiveRole(child.id, otherUser.id);
		assertTrue(role.isPresent());
		assertEquals(SpaceRole.MEMBER, role.get());
	}

	@Test
	@Transactional
	void noMembershipReturnsEmpty() {
		var user = TestUserHelper.createUser("inherit-none");
		var space = spaceService.create("No Member Space", null, SpaceVisibility.PRIVATE, user);

		var stranger = TestUserHelper.createUser("inherit-stranger");
		assertTrue(spaceService.getEffectiveRole(space.id, stranger.id).isEmpty());
	}

	@Test
	@Transactional
	void noInheritanceForRootSpace() {
		var user = TestUserHelper.createUser("inherit-root");
		var space = spaceService.create("Root Space", null, SpaceVisibility.PRIVATE, user);

		var stranger = TestUserHelper.createUser("inherit-root-stranger");
		// Root space has no parent — no inheritance possible
		assertTrue(spaceService.getEffectiveRole(space.id, stranger.id).isEmpty());
	}
}
