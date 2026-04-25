package dev.pina.backend.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;

@ConfigMapping(prefix = "pina.photo")
public interface PhotoConfig {

	@WithDefault("true")
	boolean storeOriginal();

	Compression compression();

	Thumbnails thumbnails();

	interface Compression {

		@WithDefault("jpeg")
		String format();

		@WithDefault("82")
		int quality();

		@WithDefault("2560")
		int maxResolution();
	}

	interface Thumbnails {

		@WithDefault("256")
		int xsSize();

		@WithDefault("512")
		int smSize();

		@WithDefault("1280")
		int mdWidth();

		@WithDefault("1920")
		int lgWidth();
	}
}
