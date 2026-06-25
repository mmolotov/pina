package dev.pina.backend.service;

import java.util.UUID;

/**
 * Lightweight reference to an album (id + display name) used when enriching geo
 * photos with their album membership.
 */
public record AlbumRef(UUID id, String name) {
}
