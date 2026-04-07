package dev.pina.backend.service;

import dev.pina.backend.api.dto.AdminSpaceDto;
import dev.pina.backend.domain.Space;
import dev.pina.backend.pagination.PageRequest;
import dev.pina.backend.pagination.PageResult;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class AdminSpaceService {

	private static final int MAX_PAGE_SIZE = 100;

	@Inject
	EntityManager em;

	@Inject
	SpaceService spaceService;

	public PageResult<AdminSpaceDto> listSpaces(PageRequest pageRequest, String search) {
		int size = pageRequest.effectiveSize(MAX_PAGE_SIZE);
		int offset = pageRequest.offset(MAX_PAGE_SIZE);

		boolean hasSearch = search != null && !search.isBlank();
		String searchPattern = hasSearch ? "%" + search.strip().toLowerCase() + "%" : null;

		String where = hasSearch ? " WHERE LOWER(s.name) LIKE :search" : "";
		String querySql = "SELECT s FROM Space s JOIN FETCH s.creator" + where + " ORDER BY s.createdAt DESC";
		String countSql = "SELECT COUNT(s) FROM Space s" + where;

		TypedQuery<Space> query = em.createQuery(querySql, Space.class).setFirstResult(offset).setMaxResults(size + 1);
		if (hasSearch) {
			query.setParameter("search", searchPattern);
		}

		List<Space> spaces = query.getResultList();
		boolean hasNext = spaces.size() > size;
		if (hasNext) {
			spaces = spaces.subList(0, size);
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

		List<AdminSpaceDto> dtos = spaces.stream().map(this::toDto).toList();
		return new PageResult<>(dtos, pageRequest.page(), size, hasNext, totalItems, totalPages);
	}

	public Optional<AdminSpaceDto> findById(UUID spaceId) {
		Space space = em.createQuery("SELECT s FROM Space s JOIN FETCH s.creator WHERE s.id = :id", Space.class)
				.setParameter("id", spaceId).getResultStream().findFirst().orElse(null);
		if (space == null) {
			return Optional.empty();
		}
		return Optional.of(toDto(space));
	}

	public boolean forceDelete(UUID spaceId) {
		return spaceService.delete(spaceId);
	}

	private AdminSpaceDto toDto(Space space) {
		int memberCount = ((Number) em.createQuery("SELECT COUNT(sm) FROM SpaceMembership sm WHERE sm.space.id = :sid")
				.setParameter("sid", space.id).getSingleResult()).intValue();

		long albumCount = (Long) em.createQuery("SELECT COUNT(a) FROM Album a WHERE a.space.id = :sid")
				.setParameter("sid", space.id).getSingleResult();

		long photoCount = (Long) em
				.createQuery("SELECT COUNT(DISTINCT ap.photo.id) FROM AlbumPhoto ap WHERE ap.album.space.id = :sid")
				.setParameter("sid", space.id).getSingleResult();

		return new AdminSpaceDto(space.id, space.name, space.description, space.visibility,
				space.parent != null ? space.parent.id : null, space.depth, space.creator.id, space.creator.name,
				memberCount, albumCount, photoCount, space.createdAt, space.updatedAt);
	}
}
