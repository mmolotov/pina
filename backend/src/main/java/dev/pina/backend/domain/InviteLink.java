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
@Table(name = "invite_links")
public class InviteLink extends PanacheEntityBase {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	public UUID id;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "space_id", nullable = false)
	public Space space;

	@Column(nullable = false, unique = true)
	public String code;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	@ColumnDefault("'MEMBER'")
	public SpaceRole defaultRole;

	@Column
	public OffsetDateTime expiration;

	@Column
	public Integer usageLimit;

	@Column(nullable = false)
	@ColumnDefault("0")
	public int usageCount;

	@Column(nullable = false)
	@ColumnDefault("true")
	public boolean autoApprove;

	@Column(nullable = false)
	@ColumnDefault("true")
	public boolean active;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "created_by", nullable = false)
	public User createdBy;

	@Column(nullable = false, updatable = false, insertable = false)
	@ColumnDefault("now()")
	public OffsetDateTime createdAt;
}
