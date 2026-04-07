package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import dev.pina.backend.api.dto.UpdateSettingsRequest;
import dev.pina.backend.domain.InstanceSetting;
import dev.pina.backend.domain.RegistrationMode;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.Test;

@QuarkusTest
class InstanceSettingsServiceTest {

	@Inject
	InstanceSettingsService settingsService;

	@Inject
	EntityManager em;

	@Test
	@Transactional
	void getRegistrationModeReturnsOpenWhenSettingAbsent() {
		InstanceSetting.deleteById(InstanceSettingsService.REGISTRATION_MODE);
		em.flush();
		assertEquals(RegistrationMode.OPEN, settingsService.getRegistrationMode());
	}

	@Test
	@Transactional
	void updateCompressionFormatPersistsValue() {
		InstanceSetting.deleteById(InstanceSettingsService.COMPRESSION_FORMAT);
		em.flush();

		settingsService.update(new UpdateSettingsRequest(null, "png", null, null));
		assertEquals("png", settingsService.getAll().compressionFormat());

		// second call updates existing row (covers upsert update branch)
		settingsService.update(new UpdateSettingsRequest(null, "jpeg", null, null));
		assertEquals("jpeg", settingsService.getAll().compressionFormat());
	}

	@Test
	@Transactional
	void updateCompressionQualityPersistsValue() {
		InstanceSetting.deleteById(InstanceSettingsService.COMPRESSION_QUALITY);
		em.flush();

		settingsService.update(new UpdateSettingsRequest(null, null, 75, null));
		assertEquals(75, settingsService.getAll().compressionQuality());
	}

	@Test
	@Transactional
	void updateCompressionQualityRejectsOutOfBounds() {
		assertThrows(IllegalArgumentException.class,
				() -> settingsService.update(new UpdateSettingsRequest(null, null, 0, null)));
		assertThrows(IllegalArgumentException.class,
				() -> settingsService.update(new UpdateSettingsRequest(null, null, 101, null)));
	}

	@Test
	@Transactional
	void updateCompressionMaxResolutionPersistsValue() {
		InstanceSetting.deleteById(InstanceSettingsService.COMPRESSION_MAX_RESOLUTION);
		em.flush();

		settingsService.update(new UpdateSettingsRequest(null, null, null, 1920));
		assertEquals(1920, settingsService.getAll().compressionMaxResolution());
	}

	@Test
	@Transactional
	void updateCompressionMaxResolutionRejectsTooSmall() {
		assertThrows(IllegalArgumentException.class,
				() -> settingsService.update(new UpdateSettingsRequest(null, null, null, 50)));
	}

	@Test
	@Transactional
	void updateRegistrationModeCreatesNewSetting() {
		InstanceSetting.deleteById(InstanceSettingsService.REGISTRATION_MODE);
		em.flush();

		settingsService.update(new UpdateSettingsRequest("CLOSED", null, null, null));
		assertEquals(RegistrationMode.CLOSED, settingsService.getRegistrationMode());
	}
}
