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

@Entity
@Table(name = "refresh_tokens")
public class RefreshToken extends PanacheEntityBase {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	public UUID id;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "user_id", nullable = false)
	public User user;

	@Column(name = "token_hash", nullable = false, unique = true, length = 64)
	public String tokenHash;

	@Column(name = "expires_at", nullable = false)
	public OffsetDateTime expiresAt;

	@Column(nullable = false)
	@ColumnDefault("false")
	public boolean revoked;

	@Column(name = "created_at", nullable = false, updatable = false, insertable = false)
	@ColumnDefault("now()")
	public OffsetDateTime createdAt;
}
