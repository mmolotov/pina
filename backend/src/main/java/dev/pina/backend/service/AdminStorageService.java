package dev.pina.backend.service;

import dev.pina.backend.api.dto.AdminSpaceStorageDto;
import dev.pina.backend.api.dto.AdminStorageSummaryDto;
import dev.pina.backend.api.dto.AdminUserStorageDto;
import dev.pina.backend.pagination.PageRequest;
import dev.pina.backend.pagination.PageResult;
import dev.pina.backend.storage.StorageProvider;
import dev.pina.backend.storage.StorageStats;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.util.List;

@ApplicationScoped
public class AdminStorageService {

	private static final int MAX_PAGE_SIZE = 100;

	@Inject
	EntityManager em;

	@Inject
	StorageProvider storageProvider;

	public AdminStorageSummaryDto getSummary() {
		StorageStats fsStats = storageProvider.stats();

		Object[] dbStats = (Object[]) em
				.createQuery("SELECT COUNT(DISTINCT p.id), COUNT(pv), COALESCE(SUM(pv.sizeBytes), 0)"
						+ " FROM Photo p LEFT JOIN PhotoVariant pv ON pv.photo = p")
				.getSingleResult();
		long totalPhotos = (Long) dbStats[0];
		long totalVariants = (Long) dbStats[1];
		long totalStorageBytes = (Long) dbStats[2];

		return new AdminStorageSummaryDto(storageProvider.type(), totalPhotos, totalVariants, totalStorageBytes,
				fsStats.usedBytes(), fsStats.availableBytes());
	}

	public PageResult<AdminUserStorageDto> perUserBreakdown(PageRequest pageRequest) {
		int size = pageRequest.effectiveSize(MAX_PAGE_SIZE);
		int offset = pageRequest.offset(MAX_PAGE_SIZE);

		@SuppressWarnings("unchecked")
		List<Object[]> rows = em.createQuery(
				"SELECT p.uploader.id, p.uploader.name, COUNT(DISTINCT p.id), COUNT(pv), COALESCE(SUM(pv.sizeBytes), 0)"
						+ " FROM Photo p LEFT JOIN PhotoVariant pv ON pv.photo = p"
						+ " GROUP BY p.uploader.id, p.uploader.name ORDER BY COALESCE(SUM(pv.sizeBytes), 0) DESC")
				.setFirstResult(offset).setMaxResults(size + 1).getResultList();

		boolean hasNext = rows.size() > size;
		if (hasNext) {
			rows = rows.subList(0, size);
		}

		Long totalItems = null;
		Long totalPages = null;
		if (pageRequest.needsTotal()) {
			totalItems = (Long) em.createQuery("SELECT COUNT(DISTINCT p.uploader.id) FROM Photo p").getSingleResult();
			totalPages = PageResult.totalPages(totalItems, size);
		}

		List<AdminUserStorageDto> dtos = rows.stream().map(r -> new AdminUserStorageDto((java.util.UUID) r[0],
				(String) r[1], (Long) r[2], (Long) r[3], (Long) r[4])).toList();

		return new PageResult<>(dtos, pageRequest.page(), size, hasNext, totalItems, totalPages);
	}

	public PageResult<AdminSpaceStorageDto> perSpaceBreakdown(PageRequest pageRequest) {
		int size = pageRequest.effectiveSize(MAX_PAGE_SIZE);
		int offset = pageRequest.offset(MAX_PAGE_SIZE);

		@SuppressWarnings("unchecked")
		List<Object[]> rows = em
				.createQuery("SELECT a.space.id, a.space.name, COUNT(DISTINCT a.id), COUNT(DISTINCT ap.photo.id)"
						+ " FROM Album a LEFT JOIN AlbumPhoto ap ON ap.album = a" + " WHERE a.space IS NOT NULL"
						+ " GROUP BY a.space.id, a.space.name ORDER BY COUNT(DISTINCT ap.photo.id) DESC")
				.setFirstResult(offset).setMaxResults(size + 1).getResultList();

		boolean hasNext = rows.size() > size;
		if (hasNext) {
			rows = rows.subList(0, size);
		}

		Long totalItems = null;
		Long totalPages = null;
		if (pageRequest.needsTotal()) {
			totalItems = (Long) em
					.createQuery("SELECT COUNT(DISTINCT a.space.id) FROM Album a WHERE a.space IS NOT NULL")
					.getSingleResult();
			totalPages = PageResult.totalPages(totalItems, size);
		}

		List<AdminSpaceStorageDto> dtos = rows.stream()
				.map(r -> new AdminSpaceStorageDto((java.util.UUID) r[0], (String) r[1], (Long) r[2], (Long) r[3]))
				.toList();

		return new PageResult<>(dtos, pageRequest.page(), size, hasNext, totalItems, totalPages);
	}
}
