package dev.pina.backend.service;

public record ProcessedImage(byte[] data, int width, int height, String format, long sizeBytes) {
}
