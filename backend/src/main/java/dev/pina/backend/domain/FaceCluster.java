package dev.pina.backend.domain;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.Array;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "face_clusters")
public class FaceCluster extends PanacheEntityBase {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	public UUID id;

	@Column(name = "owner_id", nullable = false)
	public UUID ownerId;

	// User-assigned person name; null until named via the face APIs.
	@Column
	public String name;

	@JdbcTypeCode(SqlTypes.VECTOR)
	@Array(length = PhotoEmbedding.DIMENSION)
	@Column(nullable = false)
	public float[] centroid;

	// Running count of descriptors absorbed into the centroid (monotonic).
	@Column(name = "centroid_weight", nullable = false)
	public int centroidWeight = 1;

	@Column(nullable = false, updatable = false, insertable = false)
	@ColumnDefault("now()")
	public OffsetDateTime createdAt;

	@Column(nullable = false)
	public OffsetDateTime updatedAt = OffsetDateTime.now();

	public static List<FaceCluster> listByOwner(UUID ownerId) {
		return list("ownerId = ?1 order by createdAt", ownerId);
	}
}
