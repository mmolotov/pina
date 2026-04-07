package dev.pina.backend.domain;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import org.hibernate.annotations.ColumnDefault;

@Entity
@Table(name = "instance_settings")
public class InstanceSetting extends PanacheEntityBase {

	@Id
	public String key;

	@Column(nullable = false)
	public String value;

	@Column(nullable = false, insertable = false)
	@ColumnDefault("now()")
	public OffsetDateTime updatedAt;
}
