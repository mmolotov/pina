package dev.pina.backend.domain;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "photos")
public class Photo extends PanacheEntityBase {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	public UUID id;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "uploader_id", nullable = false)
	public User uploader;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "personal_library_id", nullable = false)
	public PersonalLibrary personalLibrary;

	@Column(nullable = false, unique = true)
	public String contentHash;

	@Column
	public String originalFilename;

	@Column(nullable = false)
	public String mimeType;

	@Column
	public Integer width;

	@Column
	public Integer height;

	@Column(nullable = false)
	public Long sizeBytes;

	@JdbcTypeCode(SqlTypes.JSON)
	public String exifData;

	@Column
	public OffsetDateTime takenAt;

	@Column(nullable = false, updatable = false, insertable = false)
	@ColumnDefault("now()")
	public OffsetDateTime createdAt;

	@OneToMany(mappedBy = "photo", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
	public List<PhotoVariant> variants = new ArrayList<>();

	public static Optional<Photo> findByContentHash(String hash) {
		return find("contentHash", hash).firstResultOptional();
	}

	public static Optional<Photo> findByIdWithRelations(UUID id) {
		return Photo.<Photo>find(
				"select distinct p from Photo p left join fetch p.variants left join fetch p.uploader left join fetch p.personalLibrary where p.id = ?1",
				id).list().stream().findFirst();
	}

	public static Optional<Photo> findByContentHashWithRelations(String hash) {
		return Photo.<Photo>find(
				"select distinct p from Photo p left join fetch p.variants left join fetch p.uploader left join fetch p.personalLibrary where p.contentHash = ?1",
				hash).list().stream().findFirst();
	}
}
