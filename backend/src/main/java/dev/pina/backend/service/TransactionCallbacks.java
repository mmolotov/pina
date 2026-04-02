package dev.pina.backend.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Status;
import jakarta.transaction.Synchronization;
import jakarta.transaction.TransactionSynchronizationRegistry;

@ApplicationScoped
public class TransactionCallbacks {

	@Inject
	TransactionSynchronizationRegistry synchronizationRegistry;

	public void afterCommit(Runnable callback) {
		if (synchronizationRegistry.getTransactionKey() == null) {
			callback.run();
			return;
		}
		synchronizationRegistry.registerInterposedSynchronization(new Synchronization() {

			@Override
			public void beforeCompletion() {
			}

			@Override
			public void afterCompletion(int status) {
				if (status == Status.STATUS_COMMITTED) {
					callback.run();
				}
			}
		});
	}
}
