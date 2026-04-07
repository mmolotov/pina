package dev.pina.backend.service;

public class InactiveUserException extends RuntimeException {

	public InactiveUserException() {
		super("User account is inactive");
	}
}
