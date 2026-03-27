package dev.pina.backend.domain;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.ColumnDefault;

@Entity
@Table(name = "photo_variants")
public class PhotoVariant extends PanacheEntityBase {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	public UUID id;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "photo_id", nullable = false)
	public Photo photo;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	public VariantType variantType;

	@Column(nullable = false)
	public String storagePath;

	@Column(nullable = false)
	public String format;

	@Column
	public Integer quality;

	@Column(nullable = false)
	public int width;

	@Column(nullable = false)
	public int height;

	@Column(nullable = false)
	public long sizeBytes;

	@Column(nullable = false, updatable = false, insertable = false)
	@ColumnDefault("now()")
	public OffsetDateTime createdAt;
}
