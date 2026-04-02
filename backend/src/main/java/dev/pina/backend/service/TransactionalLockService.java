package dev.pina.backend.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.util.Collection;
import java.util.Comparator;
import java.util.UUID;

@ApplicationScoped
public class TransactionalLockService {

	@Inject
	EntityManager em;

	public void lock(String namespace, UUID id) {
		lock(namespace + ":" + id);
	}

	public void lock(String namespace, String keyPart) {
		lock(namespace + ":" + keyPart);
	}

	public void lockAll(String namespace, Collection<UUID> ids) {
		ids.stream().sorted(Comparator.comparing(UUID::toString)).forEach(id -> lock(namespace, id));
	}

	public void lock(String key) {
		em.createNativeQuery("SELECT pg_advisory_xact_lock(hashtext(CAST(?1 AS text)))").setParameter(1, key)
				.getSingleResult();
	}
}
