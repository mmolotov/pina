package dev.pina.backend.service;

public final class MimeTypes {

	public static final String JPEG = "image/jpeg";
	public static final String PNG = "image/png";

	private static final java.util.Set<String> SUPPORTED = java.util.Set.of(JPEG, PNG);

	private MimeTypes() {
	}

	public static boolean isSupportedImage(String mimeType) {
		return mimeType != null && SUPPORTED.contains(mimeType);
	}

	public static String extensionFrom(String mimeType) {
		return switch (mimeType) {
			case JPEG -> "jpg";
			case PNG -> "png";
			default -> "bin";
		};
	}

	public static String mimeForFormat(String format) {
		return switch (format) {
			case "jpg", "jpeg" -> JPEG;
			case "png" -> PNG;
			default -> "image/" + format;
		};
	}
}
