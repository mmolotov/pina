package dev.pina.backend.api.dto;

import java.time.OffsetDateTime;

public record CreateAlbumShareLinkRequest(OffsetDateTime expiresAt) {
}
