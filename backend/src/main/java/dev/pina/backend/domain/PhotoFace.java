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
@Table(name = "photo_faces")
public class PhotoFace extends PanacheEntityBase {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	public UUID id;

	@Column(name = "photo_id", nullable = false)
	public UUID photoId;

	// Normalized [0,1] coordinates relative to the analyzed image.
	@Column(name = "bbox_x", nullable = false)
	public float bboxX;

	@Column(name = "bbox_y", nullable = false)
	public float bboxY;

	@Column(name = "bbox_width", nullable = false)
	public float bboxWidth;

	@Column(name = "bbox_height", nullable = false)
	public float bboxHeight;

	@Column(nullable = false)
	public float confidence;

	// Absent when the face embedding step was skipped or failed.
	@JdbcTypeCode(SqlTypes.VECTOR)
	@Array(length = PhotoEmbedding.DIMENSION)
	@Column
	public float[] descriptor;

	@Column(nullable = false)
	public String modelId;

	@Column(nullable = false)
	public String modelVersion;

	@Column(nullable = false, updatable = false, insertable = false)
	@ColumnDefault("now()")
	public OffsetDateTime createdAt;

	public static List<PhotoFace> listByPhotoId(UUID photoId) {
		return list("photoId = ?1 order by confidence desc", photoId);
	}
}
