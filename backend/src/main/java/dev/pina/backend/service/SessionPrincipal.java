package dev.pina.backend.service;

import java.security.Principal;

public record SessionPrincipal(String name) implements Principal {

	@Override
	public String getName() {
		return name;
	}
}
