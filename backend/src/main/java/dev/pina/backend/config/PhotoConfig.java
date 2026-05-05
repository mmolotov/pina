package dev.pina.backend.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;

@ConfigMapping(prefix = "pina.photo")
public interface PhotoConfig {

	@WithDefault("true")
	boolean storeOriginal();

	Compression compression();

	Thumbnails thumbnails();

	VariantGeneration variantGeneration();

	HeavyPhase heavyPhase();

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

	interface VariantGeneration {

		// Number of CPU-bound variant scaling tasks executed in parallel across all
		// uploads. 0 means auto = max(1, availableProcessors() / 2). The pool is
		// shared, so concurrent uploads contend for the same fixed budget — this
		// keeps memory growth bounded regardless of how many uploads are in flight.
		@WithDefault("0")
		int parallelism();
	}

	interface HeavyPhase {

		// Maximum number of uploads simultaneously in the image-heavy phase
		// (decode + variant storage). 0 means auto = availableProcessors().
		// This is the primary heap-bounding knob: each in-flight upload retains
		// a full-resolution BufferedImage (~100 MB for a 24 MP source) for the
		// duration of phase 1. Cheap dedup hits do not consume a slot.
		@WithDefault("0")
		int maxConcurrent();
	}
}
