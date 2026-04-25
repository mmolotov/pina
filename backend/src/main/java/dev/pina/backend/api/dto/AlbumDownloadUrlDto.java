package dev.pina.backend.api.dto;

import java.time.OffsetDateTime;

public record AlbumDownloadUrlDto(String url, OffsetDateTime expiresAt) {
}
