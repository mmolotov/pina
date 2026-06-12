package dev.pina.backend.domain;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.Array;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "photo_embeddings")
public class PhotoEmbedding extends PanacheEntityBase {

	/** Fixed CLIP embedding dimension for the v1 schema (vector(512)). */
	public static final int DIMENSION = 512;

	@Id
	@Column(name = "photo_id")
	public UUID photoId;

	@Column(nullable = false)
	public String modelId;

	@Column(nullable = false)
	public String modelVersion;

	@JdbcTypeCode(SqlTypes.VECTOR)
	@Array(length = DIMENSION)
	@Column(nullable = false)
	public float[] embedding;

	@Column(nullable = false, updatable = false, insertable = false)
	@ColumnDefault("now()")
	public OffsetDateTime createdAt;
}
