package dev.pina.backend.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;

/**
 * Soft-delete ("Корзина" / Trash) retention settings. A trashed photo or album
 * is retained for {@link #retentionDays()} days after deletion, then
 * permanently removed by {@code TrashPurgeJob}.
 */
@ConfigMapping(prefix = "pina.trash")
public interface TrashConfig {

	/**
	 * Days a soft-deleted item is retained before it becomes eligible for purge.
	 */
	@WithDefault("30")
	int retentionDays();

	Purge purge();

	/**
	 * Purge sweep settings. The interval is also consumed directly by the
	 * {@code TrashPurgeJob} {@code @Scheduled} expression
	 * {@code {pina.trash.purge.interval}}; it is mapped here as well so that every
	 * {@code pina.trash.*} property is claimed by this strict config mapping.
	 */
	interface Purge {

		@WithDefault("24h")
		String interval();
	}
}
