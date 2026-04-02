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
class SpaceServiceVisibilityTest {

	@Inject
	SpaceService spaceService;

	@Test
	@Transactional
	void inheritMembersTrueAllowsParentRoleInheritance() {
		var creator = TestUserHelper.createUser("vis-inherit");
		var parent = spaceService.create("Vis Parent", null, SpaceVisibility.PRIVATE, creator);
		var child = spaceService.createSubspace(parent.id, "Vis Child", null, SpaceVisibility.PRIVATE, creator);

		assertTrue(child.inheritMembers);

		var member = TestUserHelper.createUser("vis-member");
		spaceService.addMember(parent.id, member.id, SpaceRole.MEMBER);

		// With inheritMembers = true (default), parent member can access child
		var role = spaceService.getEffectiveRole(child.id, member.id);
		assertTrue(role.isPresent());
		assertEquals(SpaceRole.MEMBER, role.get());
	}

	@Test
	@Transactional
	void inheritMembersFalseBlocksParentRoleInheritance() {
		var creator = TestUserHelper.createUser("vis-block");
		var parent = spaceService.create("Block Parent", null, SpaceVisibility.PRIVATE, creator);
		var child = spaceService.createSubspace(parent.id, "Block Child", null, SpaceVisibility.PRIVATE, creator);

		// Restrict the child
		spaceService.update(child.id, child.name, child.description, null, false);

		var member = TestUserHelper.createUser("vis-blocked-member");
		spaceService.addMember(parent.id, member.id, SpaceRole.MEMBER);

		// With inheritMembers = false, parent member cannot access child
		assertTrue(spaceService.getEffectiveRole(child.id, member.id).isEmpty());
	}

	@Test
	@Transactional
	void directMembershipStillWorksWhenInheritDisabled() {
		var creator = TestUserHelper.createUser("vis-direct");
		var parent = spaceService.create("Direct Parent", null, SpaceVisibility.PRIVATE, creator);
		var child = spaceService.createSubspace(parent.id, "Direct Child", null, SpaceVisibility.PRIVATE, creator);

		spaceService.update(child.id, child.name, child.description, null, false);

		var member = TestUserHelper.createUser("vis-direct-member");
		spaceService.addMember(child.id, member.id, SpaceRole.VIEWER);

		// Direct membership works even with inheritMembers = false
		var role = spaceService.getEffectiveRole(child.id, member.id);
		assertTrue(role.isPresent());
		assertEquals(SpaceRole.VIEWER, role.get());
	}

	@Test
	@Transactional
	void inheritMembersFalseBlocksDeepInheritance() {
		var creator = TestUserHelper.createUser("vis-deep");
		var grandparent = spaceService.create("Deep GP", null, SpaceVisibility.PRIVATE, creator);
		var parent = spaceService.createSubspace(grandparent.id, "Deep P", null, SpaceVisibility.PRIVATE, creator);
		var child = spaceService.createSubspace(parent.id, "Deep C", null, SpaceVisibility.PRIVATE, creator);

		// Block inheritance at parent level
		spaceService.update(parent.id, parent.name, parent.description, null, false);

		var member = TestUserHelper.createUser("vis-deep-member");
		spaceService.addMember(grandparent.id, member.id, SpaceRole.ADMIN);

		// Grandparent member cannot reach parent (blocked) or child
		assertTrue(spaceService.getEffectiveRole(parent.id, member.id).isEmpty());
		assertTrue(spaceService.getEffectiveRole(child.id, member.id).isEmpty());
	}

	@Test
	@Transactional
	void reEnablingInheritMembersRestoresAccess() {
		var creator = TestUserHelper.createUser("vis-reenable");
		var parent = spaceService.create("Re-enable Parent", null, SpaceVisibility.PRIVATE, creator);
		var child = spaceService.createSubspace(parent.id, "Re-enable Child", null, SpaceVisibility.PRIVATE, creator);

		var member = TestUserHelper.createUser("vis-reenable-member");
		spaceService.addMember(parent.id, member.id, SpaceRole.MEMBER);

		// Block
		spaceService.update(child.id, child.name, child.description, null, false);
		assertTrue(spaceService.getEffectiveRole(child.id, member.id).isEmpty());

		// Re-enable
		spaceService.update(child.id, child.name, child.description, null, true);
		assertTrue(spaceService.getEffectiveRole(child.id, member.id).isPresent());
	}
}
