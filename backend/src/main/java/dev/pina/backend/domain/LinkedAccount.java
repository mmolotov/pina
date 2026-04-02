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
import jakarta.persistence.UniqueConstraint;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.ColumnDefault;

@Entity
@Table(name = "linked_accounts", uniqueConstraints = @UniqueConstraint(columnNames = {"provider",
		"provider_account_id"}))
public class LinkedAccount extends PanacheEntityBase {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	public UUID id;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "user_id", nullable = false)
	public User user;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	public AuthProvider provider;

	@Column(nullable = false)
	public String providerAccountId;

	@Column
	public String credentials;

	@Column(nullable = false, updatable = false, insertable = false)
	@ColumnDefault("now()")
	public OffsetDateTime createdAt;
}
