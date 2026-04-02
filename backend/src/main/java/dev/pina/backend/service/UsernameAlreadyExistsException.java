package dev.pina.backend.service;

public class UsernameAlreadyExistsException extends RuntimeException {

	public UsernameAlreadyExistsException(String username) {
		super("Username already taken");
	}
}
