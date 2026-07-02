package dev.pina.backend.domain;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
import org.hibernate.annotations.SQLRestriction;

@Entity
@Table(name = "albums")
@SQLRestriction("deleted_at is null")
public class Album extends PanacheEntityBase {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	public UUID id;

	@Column(nullable = false)
	public String name;

	@Column
	public String description;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "owner_id", nullable = false)
	public User owner;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "personal_library_id")
	public PersonalLibrary personalLibrary;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "space_id")
	public Space space;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "cover_photo_id")
	public Photo coverPhoto;

	@Column(nullable = false, updatable = false, insertable = false)
	@ColumnDefault("now()")
	public OffsetDateTime createdAt;

	@Column(nullable = false, insertable = false)
	@ColumnDefault("now()")
	public OffsetDateTime updatedAt;

	/** Soft-delete marker; see {@link Photo#deletedAt}. */
	@Column
	public OffsetDateTime deletedAt;
}
