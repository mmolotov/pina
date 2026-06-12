package dev.pina.backend.service;

import com.google.protobuf.ByteString;
import dev.pina.backend.config.MlConfig;
import dev.pina.backend.domain.AnalysisJobStatus;
import dev.pina.backend.domain.Photo;
import dev.pina.backend.domain.PhotoAnalysisJob;
import dev.pina.backend.domain.PhotoEmbedding;
import dev.pina.backend.domain.PhotoFace;
import dev.pina.backend.domain.PhotoTag;
import dev.pina.backend.domain.PhotoVariant;
import dev.pina.backend.domain.VariantType;
import dev.pina.backend.storage.StoragePath;
import dev.pina.backend.storage.StorageProvider;
import dev.pina.ml.v1.AnalysisStep;
import dev.pina.ml.v1.AnalyzeImageRequest;
import dev.pina.ml.v1.AnalyzeImageResponse;
import dev.pina.ml.v1.FaceDetection;
import dev.pina.ml.v1.ImageAnalysis;
import dev.pina.ml.v1.ImageInput;
import dev.pina.ml.v1.MediaContext;
import dev.pina.ml.v1.MediaKind;
import dev.pina.ml.v1.StepResult;
import dev.pina.ml.v1.StepStatus;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import io.quarkus.grpc.GrpcClient;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.scheduler.Scheduled;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.stream.Collectors;

/**
 * Orchestrates asynchronous photo analysis against the ML service.
 *
 * Jobs are enqueued after a photo is persisted and processed by a polling
 * worker with lease-based claims: claiming a job bumps {@code attempts} and
 * pushes {@code next_attempt_at} into the future, so a crashed worker never
 * strands a job. The upload path is never blocked or failed by ML concerns.
 */
@ApplicationScoped
public class MlAnalysisService {

	private static final Logger LOG = Logger.getLogger(MlAnalysisService.class.getName());
	private static final List<VariantType> ANALYSIS_VARIANT_PREFERENCE = List.of(VariantType.THUMB_MD,
			VariantType.COMPRESSED, VariantType.ORIGINAL);

	@Inject
	MlConfig config;

	@Inject
	EntityManager em;

	@Inject
	StorageProvider storage;

	@GrpcClient("ml")
	ImageAnalysis mlClient;

	private ExecutorService workerExecutor;
	private final AtomicBoolean processing = new AtomicBoolean();

	@PostConstruct
	void init() {
		workerExecutor = Executors.newSingleThreadExecutor(runnable -> {
			Thread thread = new Thread(runnable, "ml-analysis-worker");
			thread.setDaemon(true);
			return thread;
		});
	}

	@PreDestroy
	void shutdown() {
		workerExecutor.shutdownNow();
	}

	/**
	 * Enqueues analysis for a newly persisted photo. Must never fail the upload:
	 * all errors are logged and swallowed.
	 */
	public void enqueueNewPhoto(UUID photoId) {
		if (!config.enabled()) {
			return;
		}
		try {
			QuarkusTransaction.requiringNew().run(() -> em.createNativeQuery(
					"INSERT INTO photo_analysis_jobs (photo_id) VALUES (:photoId) ON CONFLICT (photo_id) DO NOTHING")
					.setParameter("photoId", photoId).executeUpdate());
			poke();
		} catch (RuntimeException e) {
			LOG.log(Level.WARNING, "Failed to enqueue ML analysis for photo " + photoId, e);
		}
	}

	/** Schedules an immediate worker pass without blocking the caller. */
	public void poke() {
		try {
			workerExecutor.submit(this::processDueJobs);
		} catch (RuntimeException e) {
			LOG.log(Level.FINE, "ML worker poke rejected (shutting down?)", e);
		}
	}

	@Scheduled(every = "{pina.ml.poll-interval}", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
	void pollDueJobs() {
		if (!config.enabled()) {
			return;
		}
		processDueJobs();
	}

	void processDueJobs() {
		if (!processing.compareAndSet(false, true)) {
			return;
		}
		try {
			while (true) {
				List<UUID> claimed = claimDueJobs();
				for (UUID jobId : claimed) {
					processJob(jobId);
				}
				if (claimed.size() < config.batchSize()) {
					return;
				}
			}
		} finally {
			processing.set(false);
		}
	}

	private List<UUID> claimDueJobs() {
		long leaseSeconds = config.deadline().plus(Duration.ofMinutes(5)).toSeconds();
		return QuarkusTransaction.requiringNew().call(() -> {
			@SuppressWarnings("unchecked")
			List<UUID> ids = em.createNativeQuery("""
					SELECT id FROM photo_analysis_jobs
					WHERE status = 'PENDING' AND next_attempt_at <= now()
					ORDER BY next_attempt_at
					LIMIT :batch
					FOR UPDATE SKIP LOCKED
					""", UUID.class).setParameter("batch", config.batchSize()).getResultList();
			if (!ids.isEmpty()) {
				em.createNativeQuery("""
						UPDATE photo_analysis_jobs
						SET attempts = attempts + 1,
						    next_attempt_at = now() + make_interval(secs => :lease),
						    updated_at = now()
						WHERE id IN (:ids)
						""").setParameter("lease", (double) leaseSeconds).setParameter("ids", ids).executeUpdate();
			}
			return ids;
		});
	}

	private void processJob(UUID jobId) {
		JobSnapshot job = loadJob(jobId);
		if (job == null) {
			return;
		}
		AnalysisInput input;
		try {
			input = loadAnalysisInput(job.photoId());
		} catch (RuntimeException | IOException e) {
			LOG.log(Level.WARNING, "Cannot load analysis input for photo " + job.photoId(), e);
			retryOrFail(job, "cannot load analysis input: " + e.getMessage());
			return;
		}
		if (input == null) {
			// Photo vanished between claim and load; the job row is gone too
			// (FK cascade) or will never succeed - mark it failed if present.
			markTerminal(jobId, AnalysisJobStatus.FAILED, "photo no longer exists");
			return;
		}

		AnalyzeImageRequest request = AnalyzeImageRequest.newBuilder().setRequestId(jobId.toString())
				.setMedia(MediaContext.newBuilder().setKind(MediaKind.PHOTO).setMediaId(job.photoId().toString()))
				.setImage(ImageInput.newBuilder().setData(ByteString.copyFrom(input.bytes()))
						.setMimeType(input.mimeType()))
				.build();
		AnalyzeImageResponse response;
		try {
			response = mlClient.analyzeImage(request).await().atMost(config.deadline());
		} catch (StatusRuntimeException e) {
			if (e.getStatus().getCode() == Status.Code.INVALID_ARGUMENT) {
				markTerminal(jobId, AnalysisJobStatus.FAILED, "ML rejected input: " + e.getMessage());
			} else {
				retryOrFail(job, "ML call failed: " + e.getStatus());
			}
			return;
		} catch (RuntimeException e) {
			retryOrFail(job, "ML call failed: " + e);
			return;
		}

		PersistOutcome outcome;
		try {
			outcome = persistResults(job.photoId(), response);
		} catch (RuntimeException e) {
			LOG.log(Level.WARNING, "Failed to persist ML results for photo " + job.photoId(), e);
			retryOrFail(job, "persist failed: " + e.getMessage());
			return;
		}
		switch (outcome.resolution()) {
			case SUCCESS -> markTerminal(jobId, AnalysisJobStatus.COMPLETED, null);
			case RETRY -> retryOrFail(job, outcome.summary());
			case TERMINAL_FAILURE -> markTerminal(jobId, AnalysisJobStatus.FAILED, outcome.summary());
		}
	}

	// --- persistence of ML outputs ---

	enum Resolution {
		SUCCESS, RETRY, TERMINAL_FAILURE
	}

	record PersistOutcome(Resolution resolution, String summary) {
	}

	PersistOutcome persistResults(UUID photoId, AnalyzeImageResponse response) {
		Map<AnalysisStep, StepResult> steps = new EnumMap<>(AnalysisStep.class);
		for (StepResult stepResult : response.getStepResultsList()) {
			steps.put(stepResult.getStep(), stepResult);
		}
		boolean embeddingCompleted = isCompleted(steps.get(AnalysisStep.IMAGE_EMBEDDING));
		if (embeddingCompleted && response.getImageEmbedding().getValuesCount() != PhotoEmbedding.DIMENSION) {
			return new PersistOutcome(Resolution.TERMINAL_FAILURE, "unsupported embedding dimension "
					+ response.getImageEmbedding().getValuesCount() + " (expected " + PhotoEmbedding.DIMENSION + ")");
		}

		QuarkusTransaction.requiringNew().run(() -> {
			if (embeddingCompleted) {
				StepResult step = steps.get(AnalysisStep.IMAGE_EMBEDDING);
				PhotoEmbedding embedding = em.find(PhotoEmbedding.class, photoId);
				if (embedding == null) {
					embedding = new PhotoEmbedding();
					embedding.photoId = photoId;
					embedding.embedding = toFloatArray(response.getImageEmbedding().getValuesList());
					embedding.modelId = step.getModel().getModelId();
					embedding.modelVersion = step.getModel().getVersion();
					em.persist(embedding);
				} else {
					embedding.embedding = toFloatArray(response.getImageEmbedding().getValuesList());
					embedding.modelId = step.getModel().getModelId();
					embedding.modelVersion = step.getModel().getVersion();
				}
			}
			if (isCompleted(steps.get(AnalysisStep.TAGGING))) {
				StepResult step = steps.get(AnalysisStep.TAGGING);
				em.createQuery("DELETE FROM PhotoTag t WHERE t.photoId = :photoId").setParameter("photoId", photoId)
						.executeUpdate();
				for (var tag : response.getTagsList()) {
					PhotoTag photoTag = new PhotoTag();
					photoTag.photoId = photoId;
					photoTag.label = tag.getLabel();
					photoTag.confidence = tag.getConfidence();
					photoTag.modelId = step.getModel().getModelId();
					photoTag.modelVersion = step.getModel().getVersion();
					em.persist(photoTag);
				}
			}
			if (isCompleted(steps.get(AnalysisStep.FACE_DETECTION))) {
				StepResult detectionStep = steps.get(AnalysisStep.FACE_DETECTION);
				boolean descriptorsCompleted = isCompleted(steps.get(AnalysisStep.FACE_EMBEDDING));
				em.createQuery("DELETE FROM PhotoFace f WHERE f.photoId = :photoId").setParameter("photoId", photoId)
						.executeUpdate();
				for (FaceDetection face : response.getFacesList()) {
					PhotoFace photoFace = new PhotoFace();
					photoFace.photoId = photoId;
					photoFace.bboxX = face.getBox().getX();
					photoFace.bboxY = face.getBox().getY();
					photoFace.bboxWidth = face.getBox().getWidth();
					photoFace.bboxHeight = face.getBox().getHeight();
					photoFace.confidence = face.getConfidence();
					if (descriptorsCompleted && face.getEmbedding().getValuesCount() == PhotoEmbedding.DIMENSION) {
						photoFace.descriptor = toFloatArray(face.getEmbedding().getValuesList());
					}
					photoFace.modelId = detectionStep.getModel().getModelId();
					photoFace.modelVersion = detectionStep.getModel().getVersion();
					em.persist(photoFace);
				}
			}
		});

		List<StepResult> unhealthy = response.getStepResultsList().stream().filter(
				step -> step.getStatus() == StepStatus.FAILED || step.getStatus() == StepStatus.SKIPPED_UNAVAILABLE)
				.toList();
		if (unhealthy.isEmpty()) {
			return new PersistOutcome(Resolution.SUCCESS, null);
		}
		String summary = unhealthy.stream()
				.map(step -> step.getStep().name() + "=" + step.getStatus().name()
						+ (step.getErrorMessage().isBlank() ? "" : " (" + step.getErrorMessage() + ")"))
				.collect(Collectors.joining(", "));
		return new PersistOutcome(Resolution.RETRY, "incomplete analysis: " + summary);
	}

	private static boolean isCompleted(StepResult step) {
		return step != null && step.getStatus() == StepStatus.COMPLETED;
	}

	private static float[] toFloatArray(List<Float> values) {
		float[] result = new float[values.size()];
		for (int i = 0; i < result.length; i++) {
			result[i] = values.get(i);
		}
		return result;
	}

	// --- query paths for downstream search and face work ---

	public Map<UUID, List<PhotoTag>> listTagsForPhotos(List<UUID> photoIds) {
		if (photoIds.isEmpty()) {
			return Map.of();
		}
		return PhotoTag.<PhotoTag>list("photoId in ?1", photoIds).stream()
				.collect(Collectors.groupingBy(tag -> tag.photoId));
	}

	/** Nearest photos by cosine distance in the CLIP embedding space. */
	public List<UUID> findNearestPhotoIds(float[] queryEmbedding, int limit) {
		StringBuilder literal = new StringBuilder("[");
		for (int i = 0; i < queryEmbedding.length; i++) {
			if (i > 0) {
				literal.append(',');
			}
			literal.append(queryEmbedding[i]);
		}
		literal.append(']');
		@SuppressWarnings("unchecked")
		List<UUID> ids = em.createNativeQuery("""
				SELECT photo_id FROM photo_embeddings
				ORDER BY embedding <=> CAST(:query AS vector)
				LIMIT :limit
				""", UUID.class).setParameter("query", literal.toString()).setParameter("limit", limit).getResultList();
		return ids;
	}

	// --- job bookkeeping ---

	record JobSnapshot(UUID id, UUID photoId, int attempts) {
	}

	record AnalysisInput(byte[] bytes, String mimeType) {
	}

	private JobSnapshot loadJob(UUID jobId) {
		return QuarkusTransaction.requiringNew().call(() -> {
			PhotoAnalysisJob job = em.find(PhotoAnalysisJob.class, jobId);
			return job == null ? null : new JobSnapshot(job.id, job.photoId, job.attempts);
		});
	}

	private AnalysisInput loadAnalysisInput(UUID photoId) throws IOException {
		Optional<Photo> photo = QuarkusTransaction.requiringNew().call(() -> Photo.findByIdWithRelations(photoId));
		if (photo.isEmpty()) {
			return null;
		}
		PhotoVariant variant = pickAnalysisVariant(photo.get());
		try (InputStream stream = storage.retrieve(new StoragePath(variant.storagePath))) {
			byte[] bytes = stream.readAllBytes();
			String mimeType = variant.format != null ? "image/" + variant.format : photo.get().mimeType;
			return new AnalysisInput(bytes, mimeType);
		}
	}

	private PhotoVariant pickAnalysisVariant(Photo photo) {
		for (VariantType preferred : ANALYSIS_VARIANT_PREFERENCE) {
			for (PhotoVariant variant : photo.variants) {
				if (variant.variantType == preferred) {
					return variant;
				}
			}
		}
		throw new IllegalStateException("Photo " + photo.id + " has no usable analysis variant");
	}

	private void retryOrFail(JobSnapshot job, String error) {
		if (job.attempts() >= config.maxAttempts()) {
			markTerminal(job.id(), AnalysisJobStatus.FAILED,
					"max attempts (" + config.maxAttempts() + ") exceeded; last: " + error);
			return;
		}
		long backoffSeconds = backoffSeconds(job.attempts());
		QuarkusTransaction.requiringNew().run(() -> {
			PhotoAnalysisJob entity = em.find(PhotoAnalysisJob.class, job.id());
			if (entity == null) {
				return;
			}
			entity.status = AnalysisJobStatus.PENDING;
			entity.lastError = error;
			entity.nextAttemptAt = OffsetDateTime.now().plusSeconds(backoffSeconds);
			entity.updatedAt = OffsetDateTime.now();
		});
		LOG.log(Level.INFO, () -> "ML analysis for photo " + job.photoId() + " will retry in " + backoffSeconds
				+ "s (attempt " + job.attempts() + "): " + error);
	}

	private long backoffSeconds(int attempts) {
		long base = Math.max(1, config.backoffBase().toSeconds());
		long cap = Math.max(base, config.backoffCap().toSeconds());
		int exponent = Math.min(Math.max(attempts - 1, 0), 20);
		return Math.min(cap, base * (1L << exponent));
	}

	private void markTerminal(UUID jobId, AnalysisJobStatus status, String error) {
		QuarkusTransaction.requiringNew().run(() -> {
			PhotoAnalysisJob entity = em.find(PhotoAnalysisJob.class, jobId);
			if (entity == null) {
				return;
			}
			entity.status = status;
			entity.lastError = error;
			entity.updatedAt = OffsetDateTime.now();
		});
		if (status == AnalysisJobStatus.FAILED) {
			LOG.warning("ML analysis job " + jobId + " failed permanently: " + error);
		}
	}
}
