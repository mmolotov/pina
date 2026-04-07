package dev.pina.backend.service;

public class RegistrationClosedException extends RuntimeException {

	public RegistrationClosedException() {
		super("Registration is currently closed");
	}
}
