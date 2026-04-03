import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSession,
  getSessionSnapshot,
  persistSession,
  updateSessionUser,
} from "~/lib/session";
import type { AuthResponse } from "~/types/api";

describe("session store", () => {
  const authResponse: AuthResponse = {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresIn: 3600,
    user: {
      id: "user-1",
      email: "user1@example.com",
      name: "User One",
      avatarUrl: null,
    },
  };

  beforeEach(() => {
    window.sessionStorage.clear();
    clearSession();
    vi.restoreAllMocks();
  });

  it("returns the same snapshot reference until session data changes", () => {
    persistSession(authResponse);

    const firstSnapshot = getSessionSnapshot();
    const secondSnapshot = getSessionSnapshot();

    expect(firstSnapshot).toBe(secondSnapshot);
  });

  it("updates the snapshot reference when the stored user changes", () => {
    persistSession(authResponse);

    const firstSnapshot = getSessionSnapshot();
    updateSessionUser({
      ...authResponse.user,
      name: "User One Updated",
    });
    const secondSnapshot = getSessionSnapshot();

    expect(firstSnapshot).not.toBe(secondSnapshot);
    expect(secondSnapshot?.user.name).toBe("User One Updated");
  });
});
