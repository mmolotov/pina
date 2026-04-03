import { useSyncExternalStore } from "react";
import type { AuthResponse, SessionSnapshot, UserDto } from "~/types/api";

const SESSION_STORAGE_KEY = "pina.session";
const listeners = new Set<() => void>();

function readStoredSession(): SessionSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as SessionSnapshot;
  } catch {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

function notifySessionChanged() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeToSession(listener: () => void) {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === SESSION_STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getSessionSnapshot() {
  return readStoredSession();
}

export function persistSession(authResponse: AuthResponse) {
  if (typeof window === "undefined") {
    return;
  }

  const session: SessionSnapshot = {
    ...authResponse,
    receivedAt: Date.now(),
  };

  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  notifySessionChanged();
}

export function clearSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  notifySessionChanged();
}

export function updateSessionUser(user: UserDto) {
  const session = readStoredSession();
  if (!session || typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      ...session,
      user,
    } satisfies SessionSnapshot),
  );
  notifySessionChanged();
}

export function useSession() {
  return useSyncExternalStore(
    subscribeToSession,
    getSessionSnapshot,
    () => null,
  );
}
