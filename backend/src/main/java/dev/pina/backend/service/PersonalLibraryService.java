package dev.pina.backend.service;

import dev.pina.backend.domain.PersonalLibrary;
import dev.pina.backend.domain.User;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.PersistenceException;
import jakarta.transaction.Transactional;

@ApplicationScoped
public class PersonalLibraryService {

	@Transactional
	public PersonalLibrary getOrCreate(User owner) {
		return PersonalLibrary.findByOwnerId(owner.id).orElseGet(() -> {
			try {
				PersonalLibrary library = new PersonalLibrary();
				library.owner = owner;
				library.persistAndFlush();
				return library;
			} catch (PersistenceException _) {
				PersonalLibrary.getEntityManager().clear();
				return PersonalLibrary.findByOwnerId(owner.id).orElseThrow(
						() -> new IllegalStateException("Personal library creation raced but library was not found"));
			}
		});
	}
}
