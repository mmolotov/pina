package dev.pina.backend.service;

import dev.pina.backend.api.dto.AdminUserDto;
import dev.pina.backend.domain.BrowserSession;
import dev.pina.backend.domain.InstanceRole;
import dev.pina.backend.domain.LinkedAccount;
import dev.pina.backend.domain.RefreshToken;
import dev.pina.backend.domain.User;
import dev.pina.backend.pagination.PageRequest;
import dev.pina.backend.pagination.PageResult;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import jakarta.transaction.Transactional;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class AdminUserService {

	private static final int MAX_PAGE_SIZE = 100;

	@Inject
	EntityManager em;

	public PageResult<AdminUserDto> listUsers(PageRequest pageRequest, String search) {
		int size = pageRequest.effectiveSize(MAX_PAGE_SIZE);
		int offset = pageRequest.offset(MAX_PAGE_SIZE);

		boolean hasSearch = search != null && !search.isBlank();
		String searchPattern = hasSearch ? "%" + search.strip().toLowerCase() + "%" : null;

		String countSql = "SELECT COUNT(u) FROM User u"
				+ (hasSearch ? " WHERE LOWER(u.name) LIKE :search OR LOWER(u.email) LIKE :search" : "");
		String querySql = "SELECT u FROM User u"
				+ (hasSearch ? " WHERE LOWER(u.name) LIKE :search OR LOWER(u.email) LIKE :search" : "")
				+ " ORDER BY u.createdAt DESC";

		TypedQuery<User> query = em.createQuery(querySql, User.class).setFirstResult(offset).setMaxResults(size + 1);
		if (hasSearch) {
			query.setParameter("search", searchPattern);
		}

		List<User> users = query.getResultList();
		boolean hasNext = users.size() > size;
		if (hasNext) {
			users = users.subList(0, size);
		}

		Long totalItems = null;
		Long totalPages = null;
		if (pageRequest.needsTotal()) {
			TypedQuery<Long> countQuery = em.createQuery(countSql, Long.class);
			if (hasSearch) {
				countQuery.setParameter("search", searchPattern);
			}
			totalItems = countQuery.getSingleResult();
			totalPages = PageResult.totalPages(totalItems, size);
		}

		List<AdminUserDto> dtos = users.stream().map(this::toDto).toList();
		return new PageResult<>(dtos, pageRequest.page(), size, hasNext, totalItems, totalPages);
	}

	public Optional<AdminUserDto> findById(UUID userId) {
		User user = User.findById(userId);
		if (user == null) {
			return Optional.empty();
		}
		return Optional.of(toDto(user));
	}

	@Transactional
	public Optional<User> updateUser(UUID userId, InstanceRole instanceRole, Boolean active) {
		User user = User.findById(userId);
		if (user == null) {
			return Optional.empty();
		}
		if (instanceRole != null) {
			user.instanceRole = instanceRole;
		}
		if (active != null) {
			user.active = active;
		}
		user.persistAndFlush();
		if (!user.active) {
			OffsetDateTime now = OffsetDateTime.now();
			RefreshToken.update("revoked = true WHERE user.id = ?1 AND revoked = false", user.id);
			BrowserSession.update("revokedAt = ?1 WHERE user.id = ?2 AND revokedAt IS NULL", now, user.id);
		}
		return Optional.of(user);
	}

	private AdminUserDto toDto(User user) {
		List<String> providers = LinkedAccount.find("user.id", user.id).stream()
				.map(la -> ((LinkedAccount) la).provider.name()).toList();

		Object[] stats = (Object[]) em.createQuery(
				"SELECT COUNT(p), COALESCE(SUM(pv.sizeBytes), 0) FROM Photo p LEFT JOIN PhotoVariant pv ON pv.photo = p WHERE p.uploader.id = :uid")
				.setParameter("uid", user.id).getSingleResult();
		long photoCount = (Long) stats[0];
		long storageBytesUsed = (Long) stats[1];

		return new AdminUserDto(user.id, user.name, user.email, user.avatarUrl, user.instanceRole, user.active,
				user.createdAt, user.updatedAt, providers, photoCount, storageBytesUsed);
	}
}
