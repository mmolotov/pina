package dev.pina.backend.service;

import dev.pina.backend.api.dto.AdminSettingsDto;
import dev.pina.backend.api.dto.UpdateSettingsRequest;
import dev.pina.backend.domain.InstanceSetting;
import dev.pina.backend.domain.RegistrationMode;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@ApplicationScoped
public class InstanceSettingsService {

	static final String REGISTRATION_MODE = "registration_mode";
	static final String COMPRESSION_FORMAT = "compression_format";
	static final String COMPRESSION_QUALITY = "compression_quality";
	static final String COMPRESSION_MAX_RESOLUTION = "compression_max_resolution";

	private static final Set<String> VALID_FORMATS = Set.of("jpeg", "jpg", "png");

	public AdminSettingsDto getAll() {
		Map<String, String> settings = InstanceSetting.<InstanceSetting>listAll().stream()
				.collect(Collectors.toMap(s -> s.key, s -> s.value));

		return new AdminSettingsDto(settings.getOrDefault(REGISTRATION_MODE, "OPEN"),
				settings.getOrDefault(COMPRESSION_FORMAT, "jpeg"),
				Integer.parseInt(settings.getOrDefault(COMPRESSION_QUALITY, "82")),
				Integer.parseInt(settings.getOrDefault(COMPRESSION_MAX_RESOLUTION, "2560")));
	}

	public RegistrationMode getRegistrationMode() {
		InstanceSetting setting = InstanceSetting.findById(REGISTRATION_MODE);
		if (setting == null) {
			return RegistrationMode.OPEN;
		}
		try {
			return RegistrationMode.valueOf(setting.value);
		} catch (IllegalArgumentException _) {
			return RegistrationMode.OPEN;
		}
	}

	@Transactional
	public AdminSettingsDto update(UpdateSettingsRequest request) {
		if (request.registrationMode() != null) {
			try {
				RegistrationMode.valueOf(request.registrationMode());
			} catch (IllegalArgumentException _) {
				throw new IllegalArgumentException("Invalid registration mode: " + request.registrationMode());
			}
			upsert(REGISTRATION_MODE, request.registrationMode());
		}
		if (request.compressionFormat() != null) {
			if (!VALID_FORMATS.contains(request.compressionFormat().toLowerCase())) {
				throw new IllegalArgumentException("Invalid compression format: " + request.compressionFormat());
			}
			upsert(COMPRESSION_FORMAT, request.compressionFormat().toLowerCase());
		}
		if (request.compressionQuality() != null) {
			if (request.compressionQuality() < 1 || request.compressionQuality() > 100) {
				throw new IllegalArgumentException("Compression quality must be between 1 and 100");
			}
			upsert(COMPRESSION_QUALITY, String.valueOf(request.compressionQuality()));
		}
		if (request.compressionMaxResolution() != null) {
			if (request.compressionMaxResolution() < 100) {
				throw new IllegalArgumentException("Max resolution must be at least 100");
			}
			upsert(COMPRESSION_MAX_RESOLUTION, String.valueOf(request.compressionMaxResolution()));
		}
		return getAll();
	}

	private void upsert(String key, String value) {
		InstanceSetting setting = InstanceSetting.findById(key);
		if (setting == null) {
			setting = new InstanceSetting();
			setting.key = key;
		}
		setting.value = value;
		setting.updatedAt = OffsetDateTime.now();
		setting.persistAndFlush();
	}
}
