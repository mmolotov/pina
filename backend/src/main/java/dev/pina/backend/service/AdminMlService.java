package dev.pina.backend.service;

import dev.pina.backend.api.dto.AdminMlDto;
import dev.pina.backend.api.dto.AdminMlJobDto;
import dev.pina.backend.api.dto.AdminMlStatusDto;
import dev.pina.backend.config.MlConfig;
import dev.pina.backend.domain.AnalysisJobStatus;
import dev.pina.backend.domain.PhotoAnalysisJob;
import dev.pina.backend.pagination.PageRequest;
import dev.pina.backend.pagination.PageResult;
import dev.pina.ml.v1.GetServiceStatusRequest;
import dev.pina.ml.v1.GetServiceStatusResponse;
import dev.pina.ml.v1.ImageAnalysis;
import io.quarkus.grpc.GrpcClient;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Admin observability for the ML analysis subsystem: a graceful proxy of the ML
 * {@code GetServiceStatus} RPC plus read/actions over the
 * {@code photo_analysis_jobs} queue. All queue actions nudge the analysis
 * worker so retries are picked up promptly.
 */
@ApplicationScoped
public class AdminMlService {

	private static final Duration STATUS_TIMEOUT = Duration.ofSeconds(2);
	private static final int MAX_PAGE_SIZE = 100;

	@Inject
	MlConfig mlConfig;

	@Inject
	EntityManager em;

	@Inject
	MlAnalysisService mlAnalysisService;

	@GrpcClient("ml")
	ImageAnalysis mlClient;

	public AdminMlDto getMl() {
		return new AdminMlDto(status(), queueCounts());
	}

	public AdminMlStatusDto status() {
		if (!mlConfig.enabled()) {
			return AdminMlStatusDto.disabled();
		}
		try {
			GetServiceStatusResponse response = mlClient.getServiceStatus(GetServiceStatusRequest.getDefaultInstance())
					.await().atMost(STATUS_TIMEOUT);
			List<AdminMlStatusDto.Model> models = response.getModelsList().stream()
					.map(m -> new AdminMlStatusDto.Model(m.getStep().name().toLowerCase(Locale.ROOT),
							m.getModel().getModelId(), m.getModel().getVersion(), m.getModel().getRuntime(),
							m.getAvailable(), toLicense(m)))
					.toList();
			AdminMlStatusDto.Profile profile = response.hasProfile()
					? new AdminMlStatusDto.Profile(response.getProfile().getName(),
							response.getProfile().getMaxParallelAnalyses(),
							response.getProfile().getAnalysisMaxResolution(),
							List.copyOf(response.getProfile().getExecutionProvidersList()))
					: null;
			List<AdminMlStatusDto.InferenceSetting> inference = response.getInferenceSettingsList().stream()
					.map(s -> new AdminMlStatusDto.InferenceSetting(s.getKey(), s.getLabel(), s.getValue())).toList();
			return new AdminMlStatusDto(true, true, response.getServiceVersion(), response.getActiveProfile(),
					response.getReady(), models, profile, inference);
		} catch (RuntimeException _) {
			return AdminMlStatusDto.unreachable();
		}
	}

	private static AdminMlStatusDto.License toLicense(dev.pina.ml.v1.ModelAvailability model) {
		if (!model.hasLicense()) {
			return null;
		}
		dev.pina.ml.v1.License license = model.getLicense();
		return new AdminMlStatusDto.License(license.getSpdx(), emptyToNull(license.getUrl()),
				license.getCommercialUse(), license.getAllowBundling(), emptyToNull(license.getNotes()));
	}

	private static String emptyToNull(String value) {
		return value == null || value.isBlank() ? null : value;
	}

	public AdminMlDto.QueueCounts queueCounts() {
		long pending = 0;
		long completed = 0;
		long failed = 0;
		List<Object[]> rows = em
				.createQuery("SELECT j.status, COUNT(j) FROM PhotoAnalysisJob j GROUP BY j.status", Object[].class)
				.getResultList();
		for (Object[] row : rows) {
			AnalysisJobStatus status = (AnalysisJobStatus) row[0];
			long count = (Long) row[1];
			switch (status) {
				case PENDING -> pending = count;
				case COMPLETED -> completed = count;
				case FAILED -> failed = count;
			}
		}
		return new AdminMlDto.QueueCounts(pending, completed, failed);
	}

	public PageResult<AdminMlJobDto> listJobs(PageRequest pageRequest, AnalysisJobStatus statusFilter) {
		int size = pageRequest.effectiveSize(MAX_PAGE_SIZE);
		int offset = pageRequest.offset(MAX_PAGE_SIZE);
		boolean hasFilter = statusFilter != null;
		String where = hasFilter ? " WHERE j.status = :status" : "";

		var query = em
				.createQuery("SELECT j.photoId, p.originalFilename, j.status, j.attempts, j.nextAttemptAt, j.lastError,"
						+ " j.createdAt FROM PhotoAnalysisJob j LEFT JOIN Photo p ON p.id = j.photoId" + where
						+ " ORDER BY j.updatedAt DESC", Object[].class)
				.setFirstResult(offset).setMaxResults(size + 1);
		if (hasFilter) {
			query.setParameter("status", statusFilter);
		}

		List<Object[]> rows = query.getResultList();
		boolean hasNext = rows.size() > size;
		if (hasNext) {
			rows = rows.subList(0, size);
		}

		Long totalItems = null;
		Long totalPages = null;
		if (pageRequest.needsTotal()) {
			var countQuery = em.createQuery(
					"SELECT COUNT(j) FROM PhotoAnalysisJob j" + (hasFilter ? " WHERE j.status = :status" : ""),
					Long.class);
			if (hasFilter) {
				countQuery.setParameter("status", statusFilter);
			}
			totalItems = countQuery.getSingleResult();
			totalPages = PageResult.totalPages(totalItems, size);
		}

		List<AdminMlJobDto> dtos = rows.stream()
				.map(r -> new AdminMlJobDto((UUID) r[0], (String) r[1], ((AnalysisJobStatus) r[2]).name(), (int) r[3],
						(OffsetDateTime) r[4], (String) r[5], (OffsetDateTime) r[6]))
				.toList();
		return new PageResult<>(dtos, pageRequest.page(), size, hasNext, totalItems, totalPages);
	}

	/**
	 * Requeues a single FAILED job. Returns false when the photo has no job or it
	 * is not failed.
	 */
	@Transactional
	public boolean retry(UUID photoId) {
		PhotoAnalysisJob job = PhotoAnalysisJob.findByPhotoId(photoId).orElse(null);
		if (job == null || job.status != AnalysisJobStatus.FAILED) {
			return false;
		}
		requeue(job, false);
		nudgeWorker();
		return true;
	}

	/**
	 * Forces a fresh analysis pass for a photo regardless of current status
	 * (attempts reset).
	 */
	@Transactional
	public boolean reanalyze(UUID photoId) {
		PhotoAnalysisJob job = PhotoAnalysisJob.findByPhotoId(photoId).orElse(null);
		if (job == null) {
			return false;
		}
		requeue(job, true);
		nudgeWorker();
		return true;
	}

	/** Requeues every FAILED job in one statement. Returns the number affected. */
	@Transactional
	public long retryAllFailed() {
		OffsetDateTime now = OffsetDateTime.now();
		long affected = PhotoAnalysisJob.update(
				"status = ?1, lastError = null, nextAttemptAt = ?2, updatedAt = ?2 where status = ?3",
				AnalysisJobStatus.PENDING, now, AnalysisJobStatus.FAILED);
		if (affected > 0) {
			nudgeWorker();
		}
		return affected;
	}

	private static void requeue(PhotoAnalysisJob job, boolean resetAttempts) {
		OffsetDateTime now = OffsetDateTime.now();
		job.status = AnalysisJobStatus.PENDING;
		job.lastError = null;
		job.nextAttemptAt = now;
		job.updatedAt = now;
		if (resetAttempts) {
			job.attempts = 0;
		}
		job.persist();
	}

	private void nudgeWorker() {
		if (mlConfig.enabled()) {
			mlAnalysisService.poke();
		}
	}
}
