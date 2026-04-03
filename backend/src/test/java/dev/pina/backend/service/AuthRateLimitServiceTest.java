package dev.pina.backend.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AuthRateLimitServiceTest {

	AuthRateLimitService authRateLimitService;

	@BeforeEach
	void setUp() {
		authRateLimitService = AuthRateLimitService.forTesting(true, 60, 2, 3);
	}

	@Test
	void throttlesRepeatedAttemptsForTheSameKey() {
		assertTrue(authRateLimitService.check("auth|198.51.100.10").allowed());
		assertTrue(authRateLimitService.check("auth|198.51.100.10").allowed());
		assertFalse(authRateLimitService.check("auth|198.51.100.10").allowed());
	}

	@Test
	void boundedCachePreventsUnboundedCounterGrowthForUniqueKeys() {
		for (int index = 0; index < 50; index++) {
			assertTrue(authRateLimitService.check("auth|198.51.100." + index).allowed());
		}

		authRateLimitService.cleanUp();

		assertTrue(authRateLimitService.estimatedCounterCount() <= 3L);
	}
}
