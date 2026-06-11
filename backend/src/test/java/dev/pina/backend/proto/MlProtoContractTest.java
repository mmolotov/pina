package dev.pina.backend.proto;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.google.protobuf.Descriptors.Descriptor;
import com.google.protobuf.Descriptors.EnumDescriptor;
import com.google.protobuf.Descriptors.EnumValueDescriptor;
import com.google.protobuf.Descriptors.FieldDescriptor;
import com.google.protobuf.Descriptors.FileDescriptor;
import com.google.protobuf.Descriptors.MethodDescriptor;
import com.google.protobuf.Descriptors.ServiceDescriptor;
import dev.pina.ml.v1.CommonProto;
import dev.pina.ml.v1.ImageAnalysisProto;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Golden-fixture guard for the shared backend↔ML proto contract. Any change to
 * messages, field numbers, enums, or RPCs of {@code pina.ml.v1} must be
 * deliberate: regenerate the fixture with
 *
 * <pre>
 * ./gradlew test --tests "*MlProtoContractTest" -Dpina.proto.golden.update=true
 * </pre>
 *
 * and review the diff together with the ML-side impact (the Python service
 * generates its modules from the same proto source).
 */
class MlProtoContractTest {

	private static final String GOLDEN_RESOURCE = "/proto/pina-ml-v1-contract.txt";
	private static final Path GOLDEN_SOURCE_DIR = Path.of("src", "test", "resources", "proto");
	private static final Path GOLDEN_SOURCE_PATH = GOLDEN_SOURCE_DIR.resolve("pina-ml-v1-contract.txt");

	@Test
	void contractMatchesGoldenFixture() throws IOException {
		String actual = canonicalContract();
		if (Boolean.getBoolean("pina.proto.golden.update")) {
			Files.createDirectories(GOLDEN_SOURCE_DIR);
			Files.writeString(GOLDEN_SOURCE_PATH, actual, StandardCharsets.UTF_8);
			return;
		}
		assertEquals(readGolden(), actual,
				"Shared pina.ml.v1 contract drifted from the golden fixture. If the change is intentional, "
						+ "regenerate via -Dpina.proto.golden.update=true and review backend and ML consumers together.");
	}

	private String readGolden() throws IOException {
		try (InputStream in = MlProtoContractTest.class.getResourceAsStream(GOLDEN_RESOURCE)) {
			if (in == null) {
				throw new IOException("Golden fixture missing on classpath: " + GOLDEN_RESOURCE
						+ ". Generate it via -Dpina.proto.golden.update=true.");
			}
			return new String(in.readAllBytes(), StandardCharsets.UTF_8);
		}
	}

	private String canonicalContract() {
		StringBuilder sb = new StringBuilder();
		for (FileDescriptor file : List.of(CommonProto.getDescriptor(), ImageAnalysisProto.getDescriptor())) {
			appendFile(sb, file);
		}
		return sb.toString();
	}

	private void appendFile(StringBuilder sb, FileDescriptor file) {
		sb.append("file ").append(file.getName()).append('\n');
		for (EnumDescriptor enumType : file.getEnumTypes()) {
			appendEnum(sb, enumType);
		}
		for (Descriptor message : file.getMessageTypes()) {
			appendMessage(sb, message);
		}
		for (ServiceDescriptor service : file.getServices()) {
			appendService(sb, service);
		}
	}

	private void appendEnum(StringBuilder sb, EnumDescriptor enumType) {
		sb.append("enum ").append(enumType.getFullName()).append('\n');
		for (EnumValueDescriptor value : enumType.getValues()) {
			sb.append("  ").append(value.getName()).append(" = ").append(value.getNumber()).append('\n');
		}
	}

	private void appendMessage(StringBuilder sb, Descriptor message) {
		sb.append("message ").append(message.getFullName()).append('\n');
		for (FieldDescriptor field : message.getFields()) {
			sb.append("  ").append(field.getName()).append(" = ").append(field.getNumber()).append(": ")
					.append(fieldType(field)).append('\n');
		}
		for (Descriptor nested : message.getNestedTypes()) {
			appendMessage(sb, nested);
		}
		for (EnumDescriptor nested : message.getEnumTypes()) {
			appendEnum(sb, nested);
		}
	}

	private void appendService(StringBuilder sb, ServiceDescriptor service) {
		sb.append("service ").append(service.getFullName()).append('\n');
		for (MethodDescriptor method : service.getMethods()) {
			sb.append("  rpc ").append(method.getName()).append('(').append(method.getInputType().getFullName())
					.append(") returns (").append(method.getOutputType().getFullName()).append(")\n");
		}
	}

	private String fieldType(FieldDescriptor field) {
		String repeatedPrefix = field.isRepeated() ? "repeated " : "";
		String typeName = switch (field.getType()) {
			case MESSAGE -> field.getMessageType().getFullName();
			case ENUM -> field.getEnumType().getFullName();
			default -> field.getType().name().toLowerCase(java.util.Locale.ROOT);
		};
		return repeatedPrefix + typeName;
	}
}
