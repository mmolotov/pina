package dev.pina.backend.domain;

public enum SpaceRole {
	OWNER, ADMIN, MEMBER, VIEWER;

	public boolean isAtLeast(SpaceRole required) {
		return switch (required) {
			case OWNER -> this == OWNER;
			case ADMIN -> this == OWNER || this == ADMIN;
			case MEMBER -> this != VIEWER;
			case VIEWER -> true;
		};
	}
}
