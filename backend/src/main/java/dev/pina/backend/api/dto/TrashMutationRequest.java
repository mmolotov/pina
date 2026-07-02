package dev.pina.backend.api.dto;

import java.util.List;
import java.util.UUID;

/** Bulk restore/purge payload: a list of {@code {kind, id}} references. */
public record TrashMutationRequest(List<Item> items) {

	public record Item(String kind, UUID id) {
	}
}
