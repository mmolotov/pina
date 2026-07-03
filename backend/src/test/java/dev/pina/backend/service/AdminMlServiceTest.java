package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.pina.backend.api.dto.AdminMlDto;
import dev.pina.backend.api.dto.AdminMlJobDto;
import dev.pina.backend.api.dto.AdminMlStatusDto;
import dev.pina.backend.domain.AnalysisJobStatus;
import dev.pina.backend.pagination.PageRequest;
import dev.pina.backend.pagination.PageResult;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.UserTransaction;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Queue-side behaviour of {@link AdminMlService} with ML disabled (the
 * {@code %test} default), so worker nudges are no-ops and the seeded rows stay
 * in their asserted state.
 */
@QuarkusTest
class AdminMlServiceTest {

	@Inject
	AdminMlService adminMlService;

	@Inject
	EntityManager em;

	@Inject
	UserTransaction tx;

	/**
	 * Seeds a user + personal library + photo + analysis job directly, returning
	 * the photo id.
	 */
	private UUID seedJob(AnalysisJobStatus status, int attempts, String lastError) throws Exception {
		UUID userId = UUID.randomUUID();
		UUID libraryId = UUID.randomUUID();
		UUID photoId = UUID.randomUUID();
		String hash = UUID.randomUUID().toString().replace("-", "");
		tx.begin();
		em.createNativeQuery("INSERT INTO users (id, name) VALUES (?1, ?2)").setParameter(1, userId)
				.setParameter(2, "ml-cov-" + hash.substring(0, 6)).executeUpdate();
		em.createNativeQuery("INSERT INTO personal_libraries (id, owner_id) VALUES (?1, ?2)").setParameter(1, libraryId)
				.setParameter(2, userId).executeUpdate();
		em.createNativeQuery("INSERT INTO photos (id, uploader_id, personal_library_id, content_hash, mime_type,"
				+ " size_bytes, original_filename) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)").setParameter(1, photoId)
				.setParameter(2, userId).setParameter(3, libraryId).setParameter(4, hash).setParameter(5, "image/jpeg")
				.setParameter(6, 1000L).setParameter(7, "IMG_" + hash.substring(0, 4) + ".jpg").executeUpdate();
		em.createNativeQuery(
				"INSERT INTO photo_analysis_jobs (photo_id, status, attempts, last_error) VALUES (?1, ?2, ?3, ?4)")
				.setParameter(1, photoId).setParameter(2, status.name()).setParameter(3, attempts)
				.setParameter(4, lastError).executeUpdate();
		tx.commit();
		return photoId;
	}

	private AnalysisJobStatus statusOf(UUID photoId) {
		return AnalysisJobStatus
				.valueOf((String) em.createNativeQuery("SELECT status FROM photo_analysis_jobs WHERE photo_id = ?1")
						.setParameter(1, photoId).getSingleResult());
	}

	private int attemptsOf(UUID photoId) {
		return ((Number) em.createNativeQuery("SELECT attempts FROM photo_analysis_jobs WHERE photo_id = ?1")
				.setParameter(1, photoId).getSingleResult()).intValue();
	}

	@Test
	void countsAndListReflectSeededJobs() throws Exception {
		UUID failed = seedJob(AnalysisJobStatus.FAILED, 2, "boom");
		AdminMlDto.QueueCounts counts = adminMlService.queueCounts();
		assertTrue(counts.failed() >= 1);

		PageResult<AdminMlJobDto> page = adminMlService.listJobs(new PageRequest(0, 50, true),
				AnalysisJobStatus.FAILED);
		assertTrue(page.items().stream().anyMatch(
				job -> job.photoId().equals(failed) && job.photoName() != null && "FAILED".equals(job.status())));
	}

	@Test
	void retryRequeuesOnlyFailedJobs() throws Exception {
		UUID failed = seedJob(AnalysisJobStatus.FAILED, 3, "boom");
		assertTrue(adminMlService.retry(failed));
		assertEquals(AnalysisJobStatus.PENDING, statusOf(failed));
		assertFalse(adminMlService.retry(failed)); // now PENDING, no longer FAILED
		assertFalse(adminMlService.retry(UUID.randomUUID())); // unknown photo
	}

	@Test
	void reanalyzeResetsAttempts() throws Exception {
		UUID completed = seedJob(AnalysisJobStatus.COMPLETED, 5, null);
		assertTrue(adminMlService.reanalyze(completed));
		assertEquals(AnalysisJobStatus.PENDING, statusOf(completed));
		assertEquals(0, attemptsOf(completed));
		assertFalse(adminMlService.reanalyze(UUID.randomUUID()));
	}

	@Test
	void retryAllFailedRequeuesEveryFailure() throws Exception {
		seedJob(AnalysisJobStatus.FAILED, 1, "a");
		seedJob(AnalysisJobStatus.FAILED, 1, "b");
		assertTrue(adminMlService.retryAllFailed() >= 2);
	}

	@Test
	void statusIsDisabledWhenMlOff() {
		AdminMlStatusDto status = adminMlService.status();
		assertFalse(status.enabled());
		assertFalse(status.reachable());
		assertTrue(status.models().isEmpty());
	}
}
