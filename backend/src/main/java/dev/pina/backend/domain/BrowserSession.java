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
@Table(name = "browser_sessions")
public class BrowserSession extends PanacheEntityBase {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	public UUID id;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "user_id", nullable = false)
	public User user;

	@Column(name = "session_hash", nullable = false, unique = true, length = 64)
	public String sessionHash;

	@Column(name = "csrf_token_hash", nullable = false, length = 64)
	public String csrfTokenHash;

	@Enumerated(EnumType.STRING)
	@Column(name = "session_type", nullable = false, length = 32)
	public BrowserSessionType sessionType;

	@Column(name = "user_agent_hash", length = 64)
	public String userAgentHash;

	@Column(name = "ip_hash", length = 64)
	public String ipHash;

	@Column(name = "expires_at", nullable = false)
	public OffsetDateTime expiresAt;

	@Column(name = "revoked_at")
	public OffsetDateTime revokedAt;

	@Column(name = "created_at", nullable = false, updatable = false, insertable = false)
	@ColumnDefault("now()")
	public OffsetDateTime createdAt;
}
