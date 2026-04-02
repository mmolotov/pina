package dev.pina.backend.service;

public class EmailAlreadyExistsException extends RuntimeException {

	public EmailAlreadyExistsException() {
		super("Email already in use");
	}

	public EmailAlreadyExistsException(String message) {
		super(message);
	}
}
