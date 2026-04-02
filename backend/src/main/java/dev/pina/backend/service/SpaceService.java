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
import jakarta.persistence.PersistenceException;
import jakarta.transaction.Transactional;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@ApplicationScoped
public class SpaceService {

	private static final int MAX_DEPTH = 5;

	@Inject
	EntityManager em;

	@Inject
	FavoriteService favoriteService;

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
		List<UUID> directMemberships = em
				.createQuery("SELECT sm.space.id FROM SpaceMembership sm WHERE sm.user.id = :userId", UUID.class)
				.setParameter("userId", userId).getResultList();
		if (directMemberships.isEmpty()) {
			return Set.of();
		}

		Set<UUID> accessible = new LinkedHashSet<>(directMemberships);
		Set<UUID> frontier = new LinkedHashSet<>(directMemberships);
		for (int depth = 0; depth < MAX_DEPTH && !frontier.isEmpty(); depth++) {
			List<UUID> inheritedChildren = em
					.createQuery("SELECT s.id FROM Space s WHERE s.parent.id IN :parentIds AND s.inheritMembers = true",
							UUID.class)
					.setParameter("parentIds", frontier).getResultList();
			frontier = new LinkedHashSet<>();
			for (UUID childId : inheritedChildren) {
				if (accessible.add(childId)) {
					frontier.add(childId);
				}
			}
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
		if (Space.count("id", id) == 0) {
			return false;
		}

		var spaceIds = collectSpaceTreeIds(id);
		if (!spaceIds.isEmpty()) {
			List<UUID> albumIds = em.createQuery("SELECT a.id FROM Album a WHERE a.space.id IN :spaceIds", UUID.class)
					.setParameter("spaceIds", spaceIds).getResultList();
			if (!albumIds.isEmpty()) {
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

	// ── Membership ────────────────────────────────────────────────────────

	public Optional<SpaceRole> getUserRole(UUID spaceId, UUID userId) {
		return SpaceMembership.find("space.id = ?1 and user.id = ?2", spaceId, userId)
				.<SpaceMembership>firstResultOptional().map(m -> m.role);
	}

	public Optional<SpaceRole> getEffectiveRole(UUID spaceId, UUID userId) {
		Optional<SpaceRole> direct = getUserRole(spaceId, userId);
		if (direct.isPresent()) {
			return direct;
		}

		// Walk up the parent chain (max depth 5)
		UUID currentId = spaceId;
		for (int i = 0; i < MAX_DEPTH; i++) {
			Space current = Space.findById(currentId);
			if (current == null || current.parent == null) {
				return Optional.empty();
			}
			// If this space does not inherit members, stop walking
			if (!current.inheritMembers) {
				return Optional.empty();
			}
			currentId = current.parent.id;
			Optional<SpaceRole> parentRole = getUserRole(currentId, userId);
			if (parentRole.isPresent()) {
				return parentRole;
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

		Optional<SpaceMembership> targetMembership = SpaceMembership
				.find("space.id = ?1 and user.id = ?2", spaceId, targetUserId).firstResultOptional();
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
}
