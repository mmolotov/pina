package dev.pina.backend.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import dev.pina.backend.pagination.PageResult;
import java.util.List;
import java.util.function.Function;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record PageResponse<T>(List<T> items, int page, int size, boolean hasNext, Long totalItems, Long totalPages) {

	public static <T, R> PageResponse<R> from(PageResult<T> result, Function<T, R> mapper) {
		return new PageResponse<>(result.items().stream().map(mapper).toList(), result.page(), result.size(),
				result.hasNext(), result.totalItems(), result.totalPages());
	}
}
