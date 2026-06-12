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
import org.hibernate.annotations.ColumnDefault;

@Entity
@Table(name = "photo_tags")
public class PhotoTag extends PanacheEntityBase {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	public UUID id;

	@Column(name = "photo_id", nullable = false)
	public UUID photoId;

	@Column(nullable = false)
	public String label;

	@Column(nullable = false)
	public float confidence;

	@Column(nullable = false)
	public String modelId;

	@Column(nullable = false)
	public String modelVersion;

	@Column(nullable = false, updatable = false, insertable = false)
	@ColumnDefault("now()")
	public OffsetDateTime createdAt;

	public static List<PhotoTag> listByPhotoId(UUID photoId) {
		return list("photoId = ?1 order by confidence desc", photoId);
	}
}
