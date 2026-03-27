package dev.pina.backend.domain;

public enum VariantType {
	ORIGINAL("originals"), COMPRESSED("compressed"), THUMB_SM("thumbnails/sm"), THUMB_MD("thumbnails/md"), THUMB_LG(
			"thumbnails/lg");

	private final String storageFolder;

	VariantType(String storageFolder) {
		this.storageFolder = storageFolder;
	}

	public String storageFolder() {
		return storageFolder;
	}
}
