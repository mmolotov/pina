package dev.pina.backend.service;

import dev.pina.backend.domain.Album;
import dev.pina.backend.domain.FavoriteTargetType;
import dev.pina.backend.domain.Space;
import dev.pina.backend.domain.SpaceMembership;
import dev.pina.backend.domain.SpaceRole;
import dev.pina.backend.domain.SpaceVisibility;
import dev.pina.backend.domain.User;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceException;
import jakarta.transaction.Transactional;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@ApplicationScoped
public class SpaceService {

	private static final int MAX_DEPTH = 5;
	private static final String FAVORITE_TARGET_LOCK_NAMESPACE = "favorite-target-album";
	private static final String SPACE_CONTENT_LOCK_NAMESPACE = "space-content";

	@Inject
	EntityManager em;

	@Inject
	FavoriteService favoriteService;

	@Inject
	TransactionalLockService lockService;

	public enum AddMemberResult {
		CREATED, ALREADY_EXISTS, USER_NOT_FOUND
	}

	public enum RemoveMemberResult {
		REMOVED, NOT_FOUND, IS_OWNER, FORBIDDEN
	}

	// ── CRUD ──────────────────────────────────────────────────────────────

	@Transactional
	public Space create(String name, String description, SpaceVisibility visibility, User creator) {
		Space space = new Space();
		space.name = name;
		space.description = description;
		space.visibility = visibility != null ? visibility : SpaceVisibility.PRIVATE;
		space.depth = 0;
		space.inheritMembers = true;
		space.creator = creator;
		space.persistAndFlush();

		createMembership(space, creator, SpaceRole.OWNER);
		return space;
	}

	public Optional<Space> findById(UUID id) {
		return Space.findByIdOptional(id);
	}

	public List<Space> listByUser(UUID userId) {
		Set<UUID> accessibleSpaceIds = listAccessibleSpaceIds(userId);
		if (accessibleSpaceIds.isEmpty()) {
			return List.of();
		}
		return em.createQuery(
				"SELECT s FROM Space s LEFT JOIN FETCH s.creator LEFT JOIN FETCH s.parent WHERE s.id IN :spaceIds ORDER BY s.createdAt DESC",
				Space.class).setParameter("spaceIds", accessibleSpaceIds).getResultList();
	}

	public Set<UUID> listAccessibleSpaceIds(UUID userId) {
		List<?> rows = em.createNativeQuery("""
				WITH RECURSIVE accessible(id, depth) AS (
				    SELECT sm.space_id, 0
				    FROM space_memberships sm
				    WHERE sm.user_id = :userId
				  UNION
				    SELECT s.id, accessible.depth + 1
				    FROM spaces s
				    JOIN accessible ON s.parent_id = accessible.id
				    WHERE s.inherit_members = true
				      AND accessible.depth < :maxDepth
				)
				SELECT DISTINCT id
				FROM accessible
				""").setParameter("userId", userId).setParameter("maxDepth", MAX_DEPTH).getResultList();
		Set<UUID> accessible = new LinkedHashSet<>();
		for (Object row : rows) {
			accessible.add(toUuid(row));
		}
		return accessible;
	}

	@Transactional
	public Optional<Space> update(UUID id, String name, String description, SpaceVisibility visibility,
			Boolean inheritMembers) {
		return Space.<Space>findByIdOptional(id).map(space -> {
			space.name = name;
			space.description = description;
			if (visibility != null) {
				space.visibility = visibility;
			}
			if (inheritMembers != null) {
				space.inheritMembers = inheritMembers;
			}
			space.persistAndFlush();
			return space;
		});
	}

	@Transactional
	public boolean delete(UUID id) {
		lockService.lock(SPACE_CONTENT_LOCK_NAMESPACE, id);
		if (Space.count("id", id) == 0) {
			return false;
		}

		var spaceIds = lockSpaceTree(id);
		if (!spaceIds.isEmpty()) {
			List<UUID> albumIds = em.createQuery("SELECT a.id FROM Album a WHERE a.space.id IN :spaceIds", UUID.class)
					.setParameter("spaceIds", spaceIds).getResultList();
			if (!albumIds.isEmpty()) {
				lockService.lockAll(FAVORITE_TARGET_LOCK_NAMESPACE, albumIds);
				favoriteService.removeForTargets(FavoriteTargetType.ALBUM, albumIds);
			}
			Album.delete("space.id in ?1", spaceIds);
			SpaceMembership.delete("space.id in ?1", spaceIds);
		}

		em.createQuery("DELETE FROM Space s WHERE s.id = :id").setParameter("id", id).executeUpdate();
		em.flush();
		em.clear();
		return true;
	}

	// ── Subspaces ─────────────────────────────────────────────────────────

	@Transactional
	public Space createSubspace(UUID parentId, String name, String description, SpaceVisibility visibility,
			User creator) {
		lockService.lock(SPACE_CONTENT_LOCK_NAMESPACE, parentId);
		Space parent = Space.findById(parentId);
		if (parent == null) {
			throw new IllegalArgumentException("Parent space not found: " + parentId);
		}
		int childDepth = parent.depth + 1;
		if (childDepth > MAX_DEPTH) {
			throw new IllegalArgumentException("Maximum subspace depth (" + MAX_DEPTH + ") exceeded");
		}

		Space subspace = new Space();
		subspace.name = name;
		subspace.description = description;
		subspace.visibility = visibility != null ? visibility : SpaceVisibility.PRIVATE;
		subspace.parent = parent;
		subspace.depth = childDepth;
		subspace.inheritMembers = true;
		subspace.creator = creator;
		subspace.persistAndFlush();

		createMembership(subspace, creator, SpaceRole.OWNER);
		return subspace;
	}

	public List<Space> listSubspaces(UUID parentId) {
		return Space.list("parent.id", parentId);
	}

	public List<Space> listAccessibleSubspaces(UUID parentId, UUID userId) {
		return em.createQuery("""
				SELECT s
				FROM Space s
				LEFT JOIN FETCH s.creator
				LEFT JOIN FETCH s.parent
				WHERE s.parent.id = :parentId
				  AND (
				      s.inheritMembers = true
				      OR EXISTS (
				          SELECT 1
				          FROM SpaceMembership sm
				          WHERE sm.space.id = s.id AND sm.user.id = :userId
				      )
				  )
				ORDER BY s.createdAt
				""", Space.class).setParameter("parentId", parentId).setParameter("userId", userId).getResultList();
	}

	// ── Membership ────────────────────────────────────────────────────────

	public Optional<SpaceRole> getUserRole(UUID spaceId, UUID userId) {
		return SpaceMembership.find("space.id = ?1 and user.id = ?2", spaceId, userId)
				.<SpaceMembership>firstResultOptional().map(m -> m.role);
	}

	public Optional<SpaceRole> getEffectiveRole(UUID spaceId, UUID userId) {
		List<SpaceLineageNode> lineage = loadLineage(spaceId);
		if (lineage.isEmpty()) {
			return Optional.empty();
		}
		Map<UUID, SpaceRole> rolesBySpaceId = loadRolesBySpaceId(userId,
				lineage.stream().map(SpaceLineageNode::id).toList());
		SpaceRole directRole = rolesBySpaceId.get(lineage.getFirst().id());
		if (directRole != null) {
			return Optional.of(directRole);
		}

		for (int i = 0; i < lineage.size() - 1; i++) {
			SpaceLineageNode current = lineage.get(i);
			if (!current.inheritMembers()) {
				return Optional.empty();
			}
			SpaceRole inheritedRole = rolesBySpaceId.get(lineage.get(i + 1).id());
			if (inheritedRole != null) {
				return Optional.of(inheritedRole);
			}
		}
		return Optional.empty();
	}

	public List<SpaceMembership> listMembers(UUID spaceId) {
		return SpaceMembership.getEntityManager().createQuery(
				"SELECT sm FROM SpaceMembership sm JOIN FETCH sm.user WHERE sm.space.id = :spaceId ORDER BY sm.joinedAt",
				SpaceMembership.class).setParameter("spaceId", spaceId).getResultList();
	}

	@Transactional
	public AddMemberResult addMember(UUID spaceId, UUID userId, SpaceRole role) {
		SpaceRole effectiveRole = role != null ? role : SpaceRole.MEMBER;
		if (effectiveRole == SpaceRole.OWNER) {
			throw new IllegalArgumentException("Cannot assign OWNER role via add member");
		}

		Space space = Space.findById(spaceId);
		if (space == null) {
			return AddMemberResult.USER_NOT_FOUND;
		}
		User user = User.findById(userId);
		if (user == null) {
			return AddMemberResult.USER_NOT_FOUND;
		}

		Optional<SpaceMembership> existing = SpaceMembership.find("space.id = ?1 and user.id = ?2", spaceId, userId)
				.firstResultOptional();
		if (existing.isPresent()) {
			return AddMemberResult.ALREADY_EXISTS;
		}

		try {
			createMembership(space, user, effectiveRole);
		} catch (PersistenceException _) {
			SpaceMembership.getEntityManager().clear();
			return AddMemberResult.ALREADY_EXISTS;
		}
		return AddMemberResult.CREATED;
	}

	@Transactional
	public Optional<SpaceMembership> changeRole(UUID spaceId, UUID callerId, UUID targetUserId, SpaceRole newRole) {
		if (newRole == SpaceRole.OWNER) {
			throw new IllegalArgumentException("Cannot change role to OWNER");
		}

		Optional<SpaceRole> callerRole = getEffectiveRole(spaceId, callerId);
		if (callerRole.isEmpty()) {
			return Optional.empty();
		}

		if (!callerRole.get().isAtLeast(SpaceRole.ADMIN)) {
			return Optional.empty();
		}

		// Lock the target membership row to prevent concurrent role changes (TOCTOU).
		Optional<SpaceMembership> targetMembership = em.createQuery(
				"SELECT sm FROM SpaceMembership sm JOIN FETCH sm.user WHERE sm.space.id = :spaceId AND sm.user.id = :userId",
				SpaceMembership.class).setParameter("spaceId", spaceId).setParameter("userId", targetUserId)
				.setLockMode(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE).getResultStream().findFirst();

		if (targetMembership.isEmpty()) {
			return Optional.empty();
		}

		SpaceMembership membership = targetMembership.get();
		if (membership.role == SpaceRole.OWNER) {
			throw new IllegalArgumentException("Cannot change the Owner's role");
		}

		if (callerRole.get() == SpaceRole.ADMIN) {
			if (membership.role.isAtLeast(SpaceRole.ADMIN)) {
				return Optional.empty();
			}
			if (newRole.isAtLeast(SpaceRole.ADMIN)) {
				throw new IllegalArgumentException("Admins cannot promote to ADMIN or OWNER");
			}
		}

		membership.role = newRole;
		membership.persistAndFlush();
		return Optional.of(membership);
	}

	@Transactional
	public RemoveMemberResult removeMember(UUID spaceId, UUID callerId, UUID targetUserId) {
		Optional<SpaceRole> callerRole = getEffectiveRole(spaceId, callerId);
		if (callerRole.isEmpty()) {
			return RemoveMemberResult.NOT_FOUND;
		}

		Optional<SpaceMembership> targetMembership = em
				.createQuery("SELECT sm FROM SpaceMembership sm WHERE sm.space.id = :spaceId AND sm.user.id = :userId",
						SpaceMembership.class)
				.setParameter("spaceId", spaceId).setParameter("userId", targetUserId)
				.setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultStream().findFirst();
		if (targetMembership.isEmpty()) {
			return RemoveMemberResult.NOT_FOUND;
		}

		if (targetMembership.get().role == SpaceRole.OWNER) {
			return RemoveMemberResult.IS_OWNER;
		}

		if (callerId.equals(targetUserId)) {
			targetMembership.get().delete();
			return RemoveMemberResult.REMOVED;
		}

		if (!callerRole.get().isAtLeast(SpaceRole.ADMIN)) {
			return RemoveMemberResult.FORBIDDEN;
		}

		if (callerRole.get() == SpaceRole.ADMIN && targetMembership.get().role.isAtLeast(SpaceRole.ADMIN)) {
			return RemoveMemberResult.FORBIDDEN;
		}

		targetMembership.get().delete();
		return RemoveMemberResult.REMOVED;
	}

	// ── Helpers ───────────────────────────────────────────────────────────

	private void createMembership(Space space, User user, SpaceRole role) {
		SpaceMembership membership = new SpaceMembership();
		membership.space = space;
		membership.user = user;
		membership.role = role;
		membership.persistAndFlush();
	}

	private record SpaceLineageNode(UUID id, UUID parentId, boolean inheritMembers) {
	}

	private List<SpaceLineageNode> loadLineage(UUID spaceId) {
		List<?> rows = em.createNativeQuery("""
				WITH RECURSIVE lineage(id, parent_id, inherit_members, depth) AS (
				    SELECT s.id, s.parent_id, s.inherit_members, 0
				    FROM spaces s
				    WHERE s.id = :spaceId
				  UNION ALL
				    SELECT parent.id, parent.parent_id, parent.inherit_members, lineage.depth + 1
				    FROM spaces parent
				    JOIN lineage ON lineage.parent_id = parent.id
				    WHERE lineage.depth < :maxDepth
				)
				SELECT id, parent_id, inherit_members
				FROM lineage
				ORDER BY depth
				""").setParameter("spaceId", spaceId).setParameter("maxDepth", MAX_DEPTH).getResultList();
		return rows.stream().map(Object[].class::cast).map(
				row -> new SpaceLineageNode(toUuid(row[0]), row[1] == null ? null : toUuid(row[1]), toBoolean(row[2])))
				.toList();
	}

	private Map<UUID, SpaceRole> loadRolesBySpaceId(UUID userId, List<UUID> spaceIds) {
		if (spaceIds.isEmpty()) {
			return Map.of();
		}
		List<Object[]> rows = em.createQuery(
				"SELECT sm.space.id, sm.role FROM SpaceMembership sm WHERE sm.user.id = :userId AND sm.space.id IN :spaceIds",
				Object[].class).setParameter("userId", userId).setParameter("spaceIds", spaceIds).getResultList();
		Map<UUID, SpaceRole> rolesBySpaceId = new LinkedHashMap<>();
		for (Object[] row : rows) {
			rolesBySpaceId.put((UUID) row[0], (SpaceRole) row[1]);
		}
		return rolesBySpaceId;
	}

	private UUID toUuid(Object value) {
		return value instanceof UUID uuid ? uuid : UUID.fromString(value.toString());
	}

	private boolean toBoolean(Object value) {
		return value instanceof Boolean bool ? bool : Boolean.parseBoolean(value.toString());
	}

	private Set<UUID> collectSpaceTreeIds(UUID rootId) {
		Set<UUID> allIds = new LinkedHashSet<>();
		Set<UUID> frontier = new LinkedHashSet<>(Set.of(rootId));
		while (!frontier.isEmpty()) {
			allIds.addAll(frontier);
			List<UUID> childIds = em.createQuery("SELECT s.id FROM Space s WHERE s.parent.id IN :parentIds", UUID.class)
					.setParameter("parentIds", frontier).getResultList();
			frontier = new LinkedHashSet<>();
			for (UUID childId : childIds) {
				if (!allIds.contains(childId)) {
					frontier.add(childId);
				}
			}
		}
		return allIds;
	}

	private Set<UUID> lockSpaceTree(UUID rootId) {
		Set<UUID> lockedIds = new LinkedHashSet<>();
		while (true) {
			Set<UUID> currentTreeIds = collectSpaceTreeIds(rootId);
			List<UUID> newIds = currentTreeIds.stream().filter(id -> !lockedIds.contains(id)).toList();
			if (newIds.isEmpty()) {
				return currentTreeIds;
			}
			lockService.lockAll(SPACE_CONTENT_LOCK_NAMESPACE, newIds);
			lockedIds.addAll(newIds);
		}
	}
}
