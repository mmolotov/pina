import { useSyncExternalStore } from "react";
import type { AuthResponse, SessionSnapshot, UserDto } from "~/types/api";

const SESSION_STORAGE_KEY = "pina.session";
const listeners = new Set<() => void>();
let cachedRawSession: string | null = null;
let cachedSessionSnapshot: SessionSnapshot | null = null;

function readStoredSession(): SessionSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!rawValue) {
    cachedRawSession = null;
    cachedSessionSnapshot = null;
    return null;
  }

  if (rawValue === cachedRawSession) {
    return cachedSessionSnapshot;
  }

  try {
    const parsed = JSON.parse(rawValue) as SessionSnapshot;
    cachedRawSession = rawValue;
    cachedSessionSnapshot = parsed;
    return parsed;
  } catch {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    cachedRawSession = null;
    cachedSessionSnapshot = null;
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

  const rawSession = JSON.stringify(session);
  cachedRawSession = rawSession;
  cachedSessionSnapshot = session;
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, rawSession);
  notifySessionChanged();
}

export function clearSession() {
  if (typeof window === "undefined") {
    return;
  }

  cachedRawSession = null;
  cachedSessionSnapshot = null;
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  notifySessionChanged();
}

export function updateSessionUser(user: UserDto) {
  const session = readStoredSession();
  if (!session || typeof window === "undefined") {
    return;
  }

  const updatedSession = {
    ...session,
    user,
  } satisfies SessionSnapshot;
  const rawSession = JSON.stringify(updatedSession);
  cachedRawSession = rawSession;
  cachedSessionSnapshot = updatedSession;
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, rawSession);
  notifySessionChanged();
}

export function useSession() {
  return useSyncExternalStore(
    subscribeToSession,
    getSessionSnapshot,
    () => null,
  );
}
