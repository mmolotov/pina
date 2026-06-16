package dev.pina.backend.domain;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.hibernate.annotations.ColumnDefault;

@Entity
@Table(name = "photo_analysis_jobs")
public class PhotoAnalysisJob extends PanacheEntityBase {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	public UUID id;

	@Column(name = "photo_id", nullable = false)
	public UUID photoId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	public AnalysisJobStatus status = AnalysisJobStatus.PENDING;

	@Column(nullable = false)
	public int attempts;

	@Column
	public String lastError;

	@Column(nullable = false)
	public OffsetDateTime nextAttemptAt = OffsetDateTime.now();

	@Column(nullable = false, updatable = false, insertable = false)
	@ColumnDefault("now()")
	public OffsetDateTime createdAt;

	@Column(nullable = false)
	public OffsetDateTime updatedAt = OffsetDateTime.now();

	public static Optional<PhotoAnalysisJob> findByPhotoId(UUID photoId) {
		return find("photoId", photoId).firstResultOptional();
	}
}
