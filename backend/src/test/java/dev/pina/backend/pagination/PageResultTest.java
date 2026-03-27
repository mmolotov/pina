package dev.pina.backend.pagination;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

@QuarkusTest
class PageResultTest {

	@Test
	void totalPagesReturnsZeroForEmptyResult() {
		assertEquals(0L, PageResult.totalPages(0, 50));
	}

	@Test
	void totalPagesRoundsUpForNonEmptyResult() {
		assertEquals(3L, PageResult.totalPages(101, 50));
	}
}
