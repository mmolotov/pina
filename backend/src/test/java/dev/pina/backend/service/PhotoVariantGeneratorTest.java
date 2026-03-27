package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.pina.backend.domain.Photo;
import dev.pina.backend.domain.User;
import dev.pina.backend.domain.VariantType;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Set;
import java.util.stream.Collectors;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

@QuarkusTest
class PhotoVariantGeneratorTest {

	@Inject
	PhotoService photoService;

	@Inject
	UserResolver userResolver;

	@Test
	@Transactional
	void generateAllCreatesAllFiveVariants() throws IOException {
		User user = userResolver.currentUser();
		Photo photo = photoService.upload(jpegStream(Color.CYAN, 200, 150), "gen-all.jpg", "image/jpeg", user);

		// storeOriginal is true by default, so we expect 5 variants
		assertEquals(5, photo.variants.size());

		Set<VariantType> types = photo.variants.stream().map(v -> v.variantType).collect(Collectors.toSet());
		assertTrue(types.contains(VariantType.ORIGINAL));
		assertTrue(types.contains(VariantType.COMPRESSED));
		assertTrue(types.contains(VariantType.THUMB_SM));
		assertTrue(types.contains(VariantType.THUMB_MD));
		assertTrue(types.contains(VariantType.THUMB_LG));
	}

	@Test
	@Transactional
	void variantsHaveValidStoragePaths() throws IOException {
		User user = userResolver.currentUser();
		Photo photo = photoService.upload(jpegStream(Color.GREEN, 100, 80), "paths.jpg", "image/jpeg", user);

		for (var variant : photo.variants) {
			assertNotNull(variant.storagePath);
			assertTrue(variant.storagePath.length() > 0);
			assertTrue(variant.storagePath.contains("/"));
		}
	}

	@Test
	@Transactional
	void variantsHaveCorrectDimensions() throws IOException {
		User user = userResolver.currentUser();
		Photo photo = photoService.upload(jpegStream(Color.RED, 3000, 2000), "dims.jpg", "image/jpeg", user);

		for (var variant : photo.variants) {
			assertTrue(variant.width > 0);
			assertTrue(variant.height > 0);
			assertTrue(variant.sizeBytes > 0);
			assertNotNull(variant.format);
		}

		// THUMB_SM should be 256x256 (square crop)
		var thumbSm = photo.variants.stream().filter(v -> v.variantType == VariantType.THUMB_SM).findFirst()
				.orElseThrow();
		assertEquals(256, thumbSm.width);
		assertEquals(256, thumbSm.height);

		// COMPRESSED should be downscaled (max resolution 2560)
		var compressed = photo.variants.stream().filter(v -> v.variantType == VariantType.COMPRESSED).findFirst()
				.orElseThrow();
		assertTrue(compressed.width <= 2560);
		assertTrue(compressed.height <= 2560);
	}

	@Test
	@Transactional
	void originalVariantPreservesSourceDimensions() throws IOException {
		User user = userResolver.currentUser();
		Photo photo = photoService.upload(jpegStream(Color.BLUE, 500, 300), "orig.jpg", "image/jpeg", user);

		var original = photo.variants.stream().filter(v -> v.variantType == VariantType.ORIGINAL).findFirst()
				.orElseThrow();
		assertEquals(500, original.width);
		assertEquals(300, original.height);
		assertEquals("jpg", original.format);
	}

	@Test
	@Transactional
	void smallImageIsNotUpscaled() throws IOException {
		User user = userResolver.currentUser();
		Photo photo = photoService.upload(jpegStream(Color.GRAY, 100, 80), "small.jpg", "image/jpeg", user);

		var compressed = photo.variants.stream().filter(v -> v.variantType == VariantType.COMPRESSED).findFirst()
				.orElseThrow();
		// Small image should not be upscaled beyond its original size
		assertTrue(compressed.width <= 100);
		assertTrue(compressed.height <= 80);
	}

	private ByteArrayInputStream jpegStream(Color color, int width, int height) throws IOException {
		BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
		var g = image.createGraphics();
		g.setColor(color);
		g.fillRect(0, 0, width, height);
		g.dispose();
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		ImageIO.write(image, "jpg", out);
		return new ByteArrayInputStream(out.toByteArray());
	}
}
