package dev.pina.backend.service;

import dev.pina.backend.api.dto.AdminInviteLinkDto;
import dev.pina.backend.domain.InviteLink;
import dev.pina.backend.pagination.PageRequest;
import dev.pina.backend.pagination.PageResult;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import jakarta.transaction.Transactional;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class AdminInviteService {

	private static final int MAX_PAGE_SIZE = 100;

	@Inject
	EntityManager em;

	public PageResult<AdminInviteLinkDto> listAll(PageRequest pageRequest, UUID spaceId, Boolean active) {
		int size = pageRequest.effectiveSize(MAX_PAGE_SIZE);
		int offset = pageRequest.offset(MAX_PAGE_SIZE);

		List<String> conditions = new ArrayList<>();
		if (spaceId != null) {
			conditions.add("il.space.id = :spaceId");
		}
		if (active != null) {
			conditions.add("il.active = :active");
		}

		String where = conditions.isEmpty() ? "" : " WHERE " + String.join(" AND ", conditions);
		String querySql = "SELECT il FROM InviteLink il JOIN FETCH il.space JOIN FETCH il.createdBy" + where
				+ " ORDER BY il.createdAt DESC";
		String countSql = "SELECT COUNT(il) FROM InviteLink il" + where;

		TypedQuery<InviteLink> query = em.createQuery(querySql, InviteLink.class).setFirstResult(offset)
				.setMaxResults(size + 1);
		TypedQuery<Long> countQuery = em.createQuery(countSql, Long.class);

		if (spaceId != null) {
			query.setParameter("spaceId", spaceId);
			countQuery.setParameter("spaceId", spaceId);
		}
		if (active != null) {
			query.setParameter("active", active);
			countQuery.setParameter("active", active);
		}

		List<InviteLink> links = query.getResultList();
		boolean hasNext = links.size() > size;
		if (hasNext) {
			links = links.subList(0, size);
		}

		Long totalItems = null;
		Long totalPages = null;
		if (pageRequest.needsTotal()) {
			totalItems = countQuery.getSingleResult();
			totalPages = PageResult.totalPages(totalItems, size);
		}

		List<AdminInviteLinkDto> dtos = links.stream().map(AdminInviteLinkDto::from).toList();
		return new PageResult<>(dtos, pageRequest.page(), size, hasNext, totalItems, totalPages);
	}

	@Transactional
	public boolean revoke(UUID inviteId) {
		InviteLink link = InviteLink.findById(inviteId);
		if (link == null) {
			return false;
		}
		link.active = false;
		link.persistAndFlush();
		return true;
	}
}
