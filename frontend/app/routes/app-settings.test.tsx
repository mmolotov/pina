import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "~/lib/api";
import AppSettingsRoute, {
  clientAction as appSettingsClientAction,
  clientLoader as appSettingsClientLoader,
} from "~/routes/app-settings";

const apiMocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  updateCurrentUser: vi.fn(),
}));

const sessionMocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  updateSessionUser: vi.fn(),
}));

vi.mock("~/lib/api", () => ({
  ...apiMocks,
  ApiError: class ApiError extends Error {
    status: number;
    code: string;

    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

vi.mock("~/lib/session", () => ({
  ...sessionMocks,
}));

describe("AppSettingsRoute", () => {
  beforeEach(() => {
    apiMocks.getCurrentUser.mockReset();
    apiMocks.updateCurrentUser.mockReset();
    sessionMocks.useSession.mockReset();
    sessionMocks.updateSessionUser.mockReset();

    sessionMocks.useSession.mockReturnValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 900,
      receivedAt: Date.now(),
      user: {
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
        avatarUrl: null,
        instanceRole: "USER",
        active: true,
      },
    });

    apiMocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      avatarUrl: null,
      instanceRole: "USER",
      active: true,
    });

    apiMocks.updateCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Updated User",
      email: "updated@example.com",
      avatarUrl: null,
      instanceRole: "USER",
      active: true,
    });
  });

  it("updates the profile and syncs the session snapshot", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/settings",
        Component: AppSettingsRoute,
        action: async ({ request }) =>
          appSettingsClientAction({ request } as never),
        loader: async () => appSettingsClientLoader(),
      },
    ]);

    render(<Stub initialEntries={["/app/settings"]} />);

    expect(await screen.findByDisplayValue("Test User")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Updated User" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "updated@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => {
      expect(apiMocks.updateCurrentUser).toHaveBeenCalledWith({
        name: "Updated User",
        email: "updated@example.com",
      });
    });

    expect(await screen.findByText("Profile updated.")).toBeInTheDocument();
    expect(sessionMocks.updateSessionUser).toHaveBeenCalledWith({
      id: "user-1",
      name: "Updated User",
      email: "updated@example.com",
      avatarUrl: null,
      instanceRole: "USER",
      active: true,
    });
  });

  it("shows the backend message when profile update fails", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/settings",
        Component: AppSettingsRoute,
        action: async ({ request }) =>
          appSettingsClientAction({ request } as never),
        loader: async () => appSettingsClientLoader(),
      },
    ]);

    apiMocks.updateCurrentUser.mockRejectedValueOnce(
      new ApiError(409, "conflict", "Email already in use"),
    );

    render(<Stub initialEntries={["/app/settings"]} />);

    expect(await screen.findByDisplayValue("Test User")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "taken@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByText("Email already in use")).toBeInTheDocument();
  });

  it("resets local changes back to the persisted profile", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/settings",
        Component: AppSettingsRoute,
        action: async ({ request }) =>
          appSettingsClientAction({ request } as never),
        loader: async () => appSettingsClientLoader(),
      },
    ]);

    render(<Stub initialEntries={["/app/settings"]} />);

    expect(await screen.findByDisplayValue("Test User")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Draft Name" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset changes" }));

    expect(screen.getByLabelText("Display name")).toHaveValue("Test User");
  });
});
