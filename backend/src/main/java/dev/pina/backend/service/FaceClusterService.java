package dev.pina.backend.service;

import dev.pina.backend.config.MlConfig;
import dev.pina.backend.domain.FaceCluster;
import dev.pina.backend.domain.PhotoFace;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.UUID;

/**
 * Incremental nearest-centroid face clustering.
 *
 * Clusters are scoped to the photo owner (personal-library-first privacy
 * model). Assignment is deterministic by construction: it runs inside the ML
 * persist transaction in response-face order, serialized per owner through a
 * transactional advisory lock. A descriptor joins the nearest owner cluster
 * when its cosine distance to the centroid is within the configured threshold,
 * otherwise it seeds a new cluster. Clusters are never merged implicitly; merge
 * and split are explicit user operations in the face APIs.
 */
@ApplicationScoped
public class FaceClusterService {

	private static final String OWNER_LOCK_NAMESPACE = "face-cluster-owner";

	@Inject
	EntityManager em;

	@Inject
	MlConfig config;

	@Inject
	TransactionalLockService lockService;

	/**
	 * Assigns the given freshly persisted faces to clusters. Must be called inside
	 * the transaction that inserted the faces.
	 */
	public void assignFaces(UUID ownerId, List<PhotoFace> faces) {
		List<PhotoFace> clusterable = faces.stream().filter(face -> face.descriptor != null).toList();
		if (clusterable.isEmpty()) {
			return;
		}
		lockService.lock(OWNER_LOCK_NAMESPACE, ownerId);
		for (PhotoFace face : clusterable) {
			assignOne(ownerId, face);
		}
	}

	private void assignOne(UUID ownerId, PhotoFace face) {
		NearestCluster nearest = findNearestCluster(ownerId, face.descriptor);
		if (nearest != null && nearest.distance() <= config.faceClusterDistance()) {
			FaceCluster cluster = em.find(FaceCluster.class, nearest.clusterId());
			cluster.centroid = updatedCentroid(cluster.centroid, cluster.centroidWeight, face.descriptor);
			cluster.centroidWeight = cluster.centroidWeight + 1;
			cluster.updatedAt = java.time.OffsetDateTime.now();
			face.clusterId = cluster.id;
			return;
		}
		FaceCluster cluster = new FaceCluster();
		cluster.ownerId = ownerId;
		cluster.centroid = normalize(face.descriptor.clone());
		cluster.centroidWeight = 1;
		cluster.persist();
		face.clusterId = cluster.id;
	}

	private NearestCluster findNearestCluster(UUID ownerId, float[] descriptor) {
		// Flush so clusters created earlier in this transaction are visible to
		// the native nearest-neighbor query.
		em.flush();
		List<?> rows = em.createNativeQuery("""
				SELECT id, centroid <=> CAST(:descriptor AS vector) AS distance
				FROM face_clusters
				WHERE owner_id = :ownerId
				ORDER BY distance
				LIMIT 1
				""").setParameter("descriptor", toVectorLiteral(descriptor)).setParameter("ownerId", ownerId)
				.getResultList();
		if (rows.isEmpty()) {
			return null;
		}
		Object[] row = (Object[]) rows.get(0);
		return new NearestCluster((UUID) row[0], ((Number) row[1]).doubleValue());
	}

	private record NearestCluster(UUID clusterId, double distance) {
	}

	static float[] updatedCentroid(float[] centroid, int weight, float[] descriptor) {
		float[] updated = new float[centroid.length];
		for (int i = 0; i < centroid.length; i++) {
			updated[i] = centroid[i] * weight + descriptor[i];
		}
		return normalize(updated);
	}

	static float[] normalize(float[] vector) {
		double sumOfSquares = 0.0;
		for (float value : vector) {
			sumOfSquares += (double) value * value;
		}
		double norm = Math.sqrt(sumOfSquares);
		if (norm < 1.0e-12) {
			return vector;
		}
		for (int i = 0; i < vector.length; i++) {
			vector[i] = (float) (vector[i] / norm);
		}
		return vector;
	}

	private static String toVectorLiteral(float[] vector) {
		StringBuilder literal = new StringBuilder("[");
		for (int i = 0; i < vector.length; i++) {
			if (i > 0) {
				literal.append(',');
			}
			literal.append(vector[i]);
		}
		return literal.append(']').toString();
	}
}
