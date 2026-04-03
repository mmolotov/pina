package dev.pina.backend.service;

import dev.pina.backend.domain.InviteLink;
import dev.pina.backend.domain.Space;
import dev.pina.backend.domain.SpaceRole;
import dev.pina.backend.domain.User;
import dev.pina.backend.pagination.PageRequest;
import dev.pina.backend.pagination.PageResult;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
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
	private static final int MAX_PAGE_SIZE = 100;
	private static final SecureRandom RANDOM = new SecureRandom();

	@Inject
	SpaceService spaceService;

	@Inject
	EntityManager em;

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

	public PageResult<InviteLink> listBySpace(UUID spaceId, PageRequest pageRequest) {
		int effectiveSize = pageRequest.effectiveSize(MAX_PAGE_SIZE);
		List<InviteLink> results = em.createQuery(
				"SELECT il FROM InviteLink il WHERE il.space.id = :spaceId AND il.active = true ORDER BY il.createdAt DESC",
				InviteLink.class).setParameter("spaceId", spaceId).setFirstResult(pageRequest.offset(MAX_PAGE_SIZE))
				.setMaxResults(effectiveSize + 1).getResultList();
		boolean hasNext = results.size() > effectiveSize;
		List<InviteLink> items = hasNext ? results.subList(0, effectiveSize) : results;
		Long totalItems = null;
		Long totalPages = null;
		if (pageRequest.needsTotal()) {
			totalItems = em.createQuery(
					"SELECT COUNT(il) FROM InviteLink il WHERE il.space.id = :spaceId AND il.active = true", Long.class)
					.setParameter("spaceId", spaceId).getSingleResult();
			totalPages = PageResult.totalPages(totalItems, effectiveSize);
		}
		return new PageResult<>(items, pageRequest.page(), effectiveSize, hasNext, totalItems, totalPages);
	}

	public Optional<InviteLink> findByCode(String code) {
		return InviteLink.getEntityManager()
				.createQuery("SELECT il FROM InviteLink il JOIN FETCH il.space WHERE il.code = :code", InviteLink.class)
				.setParameter("code", code).getResultStream().findFirst();
	}

	public Optional<InviteLink> findPreviewableByCode(String code) {
		OffsetDateTime now = OffsetDateTime.now();
		return findByCode(code).filter(link -> isValid(link, now));
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
		OffsetDateTime now = OffsetDateTime.now();
		Optional<InviteLink> optLink = findByCodeForJoin(code);
		if (optLink.isEmpty()) {
			return JoinResult.INVALID;
		}

		InviteLink link = optLink.get();
		if (!isValid(link, now)) {
			return JoinResult.INVALID;
		}

		if (spaceService.getEffectiveRole(link.space.id, user.id).isPresent()) {
			return JoinResult.ALREADY_MEMBER;
		}

		SpaceService.AddMemberResult memberResult = spaceService.addMember(link.space.id, user.id, link.defaultRole);
		switch (memberResult) {
			case ALREADY_EXISTS :
				return JoinResult.ALREADY_MEMBER;
			case USER_NOT_FOUND :
				return JoinResult.INVALID;
			case CREATED :
				link.usageCount++;
				link.persistAndFlush();
				return JoinResult.JOINED;
		}

		return JoinResult.INVALID;
	}

	private Optional<InviteLink> findByCodeForJoin(String code) {
		return InviteLink.getEntityManager()
				.createQuery("SELECT il FROM InviteLink il JOIN FETCH il.space WHERE il.code = :code", InviteLink.class)
				.setParameter("code", code).setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultStream().findFirst();
	}

	private boolean isValid(InviteLink link, OffsetDateTime now) {
		if (!link.active) {
			return false;
		}
		if (link.expiration != null && !link.expiration.isAfter(now)) {
			return false;
		}
    return link.usageLimit == null || link.usageCount < link.usageLimit;
  }

	private String generateCode() {
		StringBuilder sb = new StringBuilder(CODE_LENGTH);
		for (int i = 0; i < CODE_LENGTH; i++) {
			sb.append(CODE_CHARS.charAt(RANDOM.nextInt(CODE_CHARS.length())));
		}
		return sb.toString();
	}
}
