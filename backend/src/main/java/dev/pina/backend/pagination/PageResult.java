package dev.pina.backend.pagination;

import java.util.List;

public record PageResult<T>(List<T> items, int page, int size, boolean hasNext, Long totalItems, Long totalPages) {

	public PageResult {
		items = List.copyOf(items);
	}

	public static long totalPages(long totalItems, int pageSize) {
		if (totalItems == 0) {
			return 0;
		}
		return (totalItems + pageSize - 1) / pageSize;
	}
}
