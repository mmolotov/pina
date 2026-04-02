package dev.pina.backend.service;

import static com.drew.metadata.exif.ExifDirectoryBase.TAG_ISO_EQUIVALENT;
import static com.drew.metadata.exif.ExifSubIFDDirectory.*;

import com.drew.imaging.ImageMetadataReader;
import com.drew.imaging.ImageProcessingException;
import com.drew.metadata.Metadata;
import com.drew.metadata.exif.ExifSubIFDDirectory;
import com.drew.metadata.exif.GpsDirectory;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.json.Json;
import jakarta.json.JsonObjectBuilder;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Date;
import java.util.logging.Level;
import java.util.logging.Logger;

@ApplicationScoped
public class ExifExtractor {

	private static final Logger LOG = Logger.getLogger(ExifExtractor.class.getName());

	public record ExifResult(String json, OffsetDateTime takenAt) {
	}

	public ExifResult extract(InputStream input) {
		try {
			Metadata metadata = ImageMetadataReader.readMetadata(input);
			JsonObjectBuilder json = Json.createObjectBuilder();
			OffsetDateTime takenAt = null;

			var exifDir = metadata.getFirstDirectoryOfType(ExifSubIFDDirectory.class);
			if (exifDir != null) {
				Date dateOriginal = exifDir.getDateOriginal();
				if (dateOriginal != null) {
					takenAt = dateOriginal.toInstant().atOffset(ZoneOffset.UTC);
					json.add("takenAt", takenAt.toString());
				}
				if (exifDir.getString(TAG_EXPOSURE_TIME) != null) {
					json.add("exposureTime", exifDir.getString(TAG_EXPOSURE_TIME));
				}
				if (exifDir.getString(TAG_FNUMBER) != null) {
					json.add("fNumber", exifDir.getString(TAG_FNUMBER));
				}
				if (exifDir.getString(TAG_ISO_EQUIVALENT) != null) {
					json.add("iso", exifDir.getString(TAG_ISO_EQUIVALENT));
				}
			}

			var gpsDir = metadata.getFirstDirectoryOfType(GpsDirectory.class);
			if (gpsDir != null && gpsDir.getGeoLocation() != null) {
				var geo = gpsDir.getGeoLocation();
				json.add("latitude", geo.getLatitude());
				json.add("longitude", geo.getLongitude());
			}

			var built = json.build();
			return new ExifResult(built.isEmpty() ? null : built.toString(), takenAt);
		} catch (ImageProcessingException | IOException e) {
			LOG.log(Level.FINE, "EXIF extraction failed (best-effort, continuing without metadata)", e);
			return new ExifResult(null, null);
		}
	}

	public ExifResult extract(Path file) {
		try (InputStream input = Files.newInputStream(file)) {
			return extract(input);
		} catch (IOException e) {
			LOG.log(Level.FINE, "EXIF extraction failed (best-effort, continuing without metadata)", e);
			return new ExifResult(null, null);
		}
	}
}
