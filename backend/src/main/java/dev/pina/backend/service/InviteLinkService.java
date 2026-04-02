package dev.pina.backend.service;

import dev.pina.backend.domain.InviteLink;
import dev.pina.backend.domain.Space;
import dev.pina.backend.domain.SpaceRole;
import dev.pina.backend.domain.User;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class InviteLinkService {

	private static final String CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	private static final int CODE_LENGTH = 12;
	private static final SecureRandom RANDOM = new SecureRandom();

	@Inject
	SpaceService spaceService;

	public enum JoinResult {
		JOINED, ALREADY_MEMBER, INVALID
	}

	@Transactional
	public InviteLink create(UUID spaceId, SpaceRole defaultRole, OffsetDateTime expiration, Integer usageLimit,
			User creator) {
		Space space = Space.findById(spaceId);
		if (space == null) {
			throw new IllegalArgumentException("Space not found");
		}

		SpaceRole effectiveRole = defaultRole != null ? defaultRole : SpaceRole.MEMBER;
		if (effectiveRole == SpaceRole.OWNER) {
			throw new IllegalArgumentException("Cannot create invite with OWNER role");
		}

		InviteLink link = new InviteLink();
		link.space = space;
		link.code = generateCode();
		link.defaultRole = effectiveRole;
		link.expiration = expiration;
		link.usageLimit = usageLimit;
		link.autoApprove = true;
		link.active = true;
		link.createdBy = creator;
		link.persistAndFlush();
		return link;
	}

	public List<InviteLink> listBySpace(UUID spaceId) {
		return InviteLink.list("space.id = ?1 and active = true order by createdAt desc", spaceId);
	}

	public Optional<InviteLink> findByCode(String code) {
		return InviteLink.getEntityManager()
				.createQuery("SELECT il FROM InviteLink il JOIN FETCH il.space WHERE il.code = :code", InviteLink.class)
				.setParameter("code", code).getResultStream().findFirst();
	}

	@Transactional
	public boolean revoke(UUID inviteId, UUID spaceId) {
		return InviteLink.<InviteLink>findByIdOptional(inviteId)
				.filter(link -> link.space.id.equals(spaceId) && link.active).map(link -> {
					link.active = false;
					link.persistAndFlush();
					return true;
				}).orElse(false);
	}

	@Transactional
	public JoinResult join(String code, User user) {
		Optional<InviteLink> optLink = findByCode(code);
		if (optLink.isEmpty()) {
			return JoinResult.INVALID;
		}

		InviteLink link = optLink.get();
		if (!isValid(link)) {
			return JoinResult.INVALID;
		}

		// Effective access already exists either directly or via inherited membership.
		if (spaceService.getEffectiveRole(link.space.id, user.id).isPresent()) {
			return JoinResult.ALREADY_MEMBER;
		}

		// Atomic increment first — if limit is exhausted, no membership is created.
		int updated = InviteLink.getEntityManager().createQuery(
				"UPDATE InviteLink il SET il.usageCount = il.usageCount + 1 WHERE il.id = :id AND il.active = true AND (il.usageLimit IS NULL OR il.usageCount < il.usageLimit) AND (il.expiration IS NULL OR il.expiration > :now)")
				.setParameter("id", link.id).setParameter("now", OffsetDateTime.now()).executeUpdate();
		if (updated == 0) {
			return JoinResult.INVALID;
		}

		// Add member after successful usage count increment.
		SpaceService.AddMemberResult memberResult = spaceService.addMember(link.space.id, user.id, link.defaultRole);
		if (memberResult == SpaceService.AddMemberResult.ALREADY_EXISTS) {
			return JoinResult.ALREADY_MEMBER;
		}
		if (memberResult == SpaceService.AddMemberResult.USER_NOT_FOUND) {
			return JoinResult.INVALID;
		}

		return JoinResult.JOINED;
	}

	private boolean isValid(InviteLink link) {
		if (!link.active) {
			return false;
		}
		if (link.expiration != null && link.expiration.isBefore(OffsetDateTime.now())) {
			return false;
		}
		if (link.usageLimit != null && link.usageCount >= link.usageLimit) {
			return false;
		}
		return true;
	}

	private String generateCode() {
		StringBuilder sb = new StringBuilder(CODE_LENGTH);
		for (int i = 0; i < CODE_LENGTH; i++) {
			sb.append(CODE_CHARS.charAt(RANDOM.nextInt(CODE_CHARS.length())));
		}
		return sb.toString();
	}
}
