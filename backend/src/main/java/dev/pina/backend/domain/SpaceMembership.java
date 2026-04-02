package dev.pina.backend.domain;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;
import org.hibernate.annotations.ColumnDefault;

@Entity
@Table(name = "space_memberships")
@IdClass(SpaceMembership.SpaceMembershipId.class)
public class SpaceMembership extends PanacheEntityBase {

	@Id
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "space_id", nullable = false)
	public Space space;

	@Id
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "user_id", nullable = false)
	public User user;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	public SpaceRole role;

	@Column(nullable = false, updatable = false, insertable = false)
	@ColumnDefault("now()")
	public OffsetDateTime joinedAt;

	public record SpaceMembershipId(UUID space, UUID user) implements Serializable {

		@Override
		public boolean equals(Object o) {
			if (this == o) {
				return true;
			}
			if (!(o instanceof SpaceMembershipId(UUID space1, UUID user1))) {
				return false;
			}
			return Objects.equals(space, space1) && Objects.equals(user, user1);
		}

		@Override
		public int hashCode() {
			return Objects.hash(space, user);
		}
	}
}
