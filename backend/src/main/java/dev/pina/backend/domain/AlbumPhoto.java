package dev.pina.backend.domain;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "album_photos")
@IdClass(AlbumPhoto.AlbumPhotoId.class)
public class AlbumPhoto extends PanacheEntityBase {

	@Id
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "album_id", nullable = false)
	public Album album;

	@Id
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "photo_id", nullable = false)
	public Photo photo;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "added_by", nullable = false)
	public User addedBy;

	@Column(nullable = false, updatable = false, insertable = false)
	@ColumnDefault("now()")
	public OffsetDateTime addedAt;

	public record AlbumPhotoId(UUID album, UUID photo) implements Serializable {

		@Override
		public boolean equals(Object o) {
			if (this == o) {
				return true;
			}
			if (!(o instanceof AlbumPhotoId(UUID album1, UUID photo1))) {
				return false;
			}
			return Objects.equals(album, album1) && Objects.equals(photo, photo1);
		}

		@Override
		public int hashCode() {
			return Objects.hash(album, photo);
		}
	}
}
