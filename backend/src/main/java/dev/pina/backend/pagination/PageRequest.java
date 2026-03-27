package dev.pina.backend.pagination;

public record PageRequest(int page, int size, boolean needsTotal) {

	public PageRequest {
		if (page < 0) {
			throw new IllegalArgumentException("page must be >= 0");
		}
		if (size <= 0) {
			throw new IllegalArgumentException("size must be > 0");
		}
	}

	public int effectiveSize(int maxPageSize) {
		return Math.min(size, maxPageSize);
	}

	public int offset(int maxPageSize) {
		int effectiveSize = effectiveSize(maxPageSize);
		try {
			return Math.multiplyExact(page, effectiveSize);
		} catch (ArithmeticException _) {
			throw new IllegalArgumentException("page is too large");
		}
	}
}
