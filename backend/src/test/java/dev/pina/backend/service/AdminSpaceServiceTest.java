package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.pina.backend.TestUserHelper;
import dev.pina.backend.domain.Space;
import dev.pina.backend.domain.SpaceVisibility;
import dev.pina.backend.domain.User;
import dev.pina.backend.pagination.PageRequest;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AdminSpaceServiceTest {

	@Inject
	AdminSpaceService adminSpaceService;

	@Inject
	SpaceService spaceService;

	@Test
	@Transactional
	void listSpacesWithSearchFiltersResults() {
		User user = TestUserHelper.createUser("admin-space-search");
		spaceService.create("SearchableAlpha", null, SpaceVisibility.PRIVATE, user);
		spaceService.create("SearchableBeta", null, SpaceVisibility.PRIVATE, user);
		spaceService.create("Unrelated", null, SpaceVisibility.PRIVATE, user);

		var result = adminSpaceService.listSpaces(new PageRequest(0, 100, false), "searchable");

		assertTrue(result.items().size() >= 2);
		result.items().forEach(dto -> assertTrue(dto.name().toLowerCase().contains("searchable")));
	}

	@Test
	@Transactional
	void listSpacesWithNeedsTotalReturnsCounts() {
		User user = TestUserHelper.createUser("admin-space-total");
		spaceService.create("TotalSpace1", null, SpaceVisibility.PRIVATE, user);

		var result = adminSpaceService.listSpaces(new PageRequest(0, 100, true), null);

		assertNotNull(result.totalItems());
		assertNotNull(result.totalPages());
		assertTrue(result.totalItems() >= 1);
	}

	@Test
	@Transactional
	void listSpacesWithSearchAndNeedsTotalReturnsCounts() {
		User user = TestUserHelper.createUser("admin-space-search-total");
		spaceService.create("CountableSpace", null, SpaceVisibility.PRIVATE, user);

		var result = adminSpaceService.listSpaces(new PageRequest(0, 100, true), "Countable");

		assertNotNull(result.totalItems());
		assertTrue(result.totalItems() >= 1);
	}

	@Test
	@Transactional
	void findByIdReturnsEmptyForNonExistentSpace() {
		assertTrue(adminSpaceService.findById(UUID.randomUUID()).isEmpty());
	}

	@Test
	@Transactional
	void toDtoIncludesParentIdForSubspace() {
		User user = TestUserHelper.createUser("admin-space-parent");
		Space parent = spaceService.create("ParentSpace", null, SpaceVisibility.PRIVATE, user);
		Space child = spaceService.createSubspace(parent.id, "ChildSpace", null, SpaceVisibility.PRIVATE, user);

		var dto = adminSpaceService.findById(child.id);

		assertTrue(dto.isPresent());
		assertEquals(parent.id, dto.get().parentId());
	}

	@Test
	@Transactional
	void toDtoHasNullParentIdForRootSpace() {
		User user = TestUserHelper.createUser("admin-space-root");
		Space root = spaceService.create("RootSpace", null, SpaceVisibility.PRIVATE, user);

		var dto = adminSpaceService.findById(root.id);

		assertTrue(dto.isPresent());
		assertNull(dto.get().parentId());
	}
}
