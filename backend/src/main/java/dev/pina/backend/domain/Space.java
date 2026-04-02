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
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.ColumnDefault;

@Entity
@Table(name = "spaces")
public class Space extends PanacheEntityBase {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	public UUID id;

	@Column(nullable = false)
	public String name;

	@Column
	public String description;

	@Column
	public String avatarUrl;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	@ColumnDefault("'PRIVATE'")
	public SpaceVisibility visibility;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "parent_id")
	public Space parent;

	@Column(nullable = false)
	@ColumnDefault("0")
	@Min(0) @Max(5) public int depth;

	@Column(nullable = false)
	@ColumnDefault("true")
	public boolean inheritMembers;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "creator_id", nullable = false)
	public User creator;

	@Column(nullable = false, updatable = false, insertable = false)
	@ColumnDefault("now()")
	public OffsetDateTime createdAt;

	@Column(nullable = false, insertable = false)
	@ColumnDefault("now()")
	public OffsetDateTime updatedAt;
}
