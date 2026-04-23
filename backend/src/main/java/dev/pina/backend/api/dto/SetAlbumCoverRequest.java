package dev.pina.backend.api.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record SetAlbumCoverRequest(@NotNull UUID photoId) {
}
