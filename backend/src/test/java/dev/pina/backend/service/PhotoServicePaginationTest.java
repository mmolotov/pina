package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PhotoServicePaginationTest {

	@Test
	void orderingHelperSkipsRowsThatDisappearBetweenQueries() {
		UUID firstId = UUID.randomUUID();
		UUID secondId = UUID.randomUUID();
		UUID thirdId = UUID.randomUUID();
		Map<UUID, String> itemsById = new LinkedHashMap<>();
		itemsById.put(firstId, "first");
		itemsById.put(thirdId, "third");

		List<String> ordered = PhotoService.orderExistingPageItems(List.of(firstId, secondId, thirdId), itemsById);

		assertEquals(List.of("first", "third"), ordered);
	}
}
