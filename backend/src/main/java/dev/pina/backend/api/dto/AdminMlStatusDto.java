package dev.pina.backend.api.dto;

import java.util.List;

/**
 * ML service observability snapshot for the admin panel. Composed from the ML
 * {@code GetServiceStatus} RPC with graceful degradation: when ML is disabled
 * or unreachable, {@code reachable} is false and the detail lists are empty.
 *
 * <p>
 * {@code profile} and {@code inferenceSettings}, and each model's
 * {@code license}, are populated once the proto contract carries them (Part
 * C2); until then they stay null/empty and the UI hides those affordances.
 */
public record AdminMlStatusDto(boolean enabled, boolean reachable, String serviceVersion, String activeProfile,
		boolean ready, List<Model> models, Profile profile, List<InferenceSetting> inferenceSettings) {

	public record License(String spdx, String url, boolean commercialUse, boolean allowBundling, String notes) {
	}

	public record Model(String step, String modelId, String version, String runtime, boolean available,
			License license) {
	}

	public record Profile(String name, int maxParallelAnalyses, int analysisMaxResolution,
			List<String> executionProviders) {
	}

	public record InferenceSetting(String key, String label, String value) {
	}

	public static AdminMlStatusDto disabled() {
		return new AdminMlStatusDto(false, false, null, null, false, List.of(), null, List.of());
	}

	public static AdminMlStatusDto unreachable() {
		return new AdminMlStatusDto(true, false, null, null, false, List.of(), null, List.of());
	}
}
