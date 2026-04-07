import { render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppAdminLayoutRoute from "~/routes/app-admin-layout";

const apiMocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

const sessionMocks = vi.hoisted(() => ({
  updateSessionUser: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("~/lib/api", () => ({
  ...apiMocks,
}));

vi.mock("~/lib/session", () => ({
  ...sessionMocks,
}));

describe("AppAdminLayoutRoute", () => {
  beforeEach(() => {
    apiMocks.getCurrentUser.mockReset();
    sessionMocks.updateSessionUser.mockReset();
    sessionMocks.useSession.mockReset();
  });

  it("renders admin navigation for instance admins", async () => {
    sessionMocks.useSession.mockReturnValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 900,
      receivedAt: Date.now(),
      user: {
        id: "admin-1",
        name: "Admin User",
        email: "admin@example.com",
        avatarUrl: null,
        instanceRole: "ADMIN",
        active: true,
      },
    });

    const Stub = createRoutesStub([
      {
        path: "/app/admin",
        Component: AppAdminLayoutRoute,
        children: [
          {
            path: "users",
            Component: () => <div>Users section</div>,
          },
        ],
      },
    ]);

    render(<Stub initialEntries={["/app/admin/users"]} />);

    expect(await screen.findByText("Instance control")).toBeInTheDocument();
    expect(screen.getByText("Users section")).toBeInTheDocument();
    expect(
      screen.getByText("Instance-wide administration"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Users/i })).toHaveAttribute(
      "href",
      "/app/admin/users",
    );
  });

  it("renders a denial state for non-admin users", async () => {
    sessionMocks.useSession.mockReturnValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 900,
      receivedAt: Date.now(),
      user: {
        id: "user-1",
        name: "Regular User",
        email: "user@example.com",
        avatarUrl: null,
        instanceRole: "USER",
        active: true,
      },
    });

    const Stub = createRoutesStub([
      {
        path: "/app/admin",
        Component: AppAdminLayoutRoute,
      },
    ]);

    render(<Stub initialEntries={["/app/admin"]} />);

    expect(await screen.findByText("Access denied")).toBeInTheDocument();
    expect(
      screen.getByText("You do not have admin access"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Return to library" }),
    ).toHaveAttribute("href", "/app/library");
  });

  it("loads missing capability data before opening the admin shell", async () => {
    sessionMocks.useSession.mockReturnValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 900,
      receivedAt: Date.now(),
      user: {
        id: "admin-2",
        name: "Bootstrap Admin",
        email: "bootstrap@example.com",
        avatarUrl: null,
      },
    });
    apiMocks.getCurrentUser.mockResolvedValue({
      id: "admin-2",
      name: "Bootstrap Admin",
      email: "bootstrap@example.com",
      avatarUrl: null,
      instanceRole: "ADMIN",
      active: true,
    });

    const Stub = createRoutesStub([
      {
        path: "/app/admin",
        Component: AppAdminLayoutRoute,
        children: [
          {
            path: "health",
            Component: () => <div>Health section</div>,
          },
        ],
      },
    ]);

    render(<Stub initialEntries={["/app/admin/health"]} />);

    expect(screen.getByText("Loading admin access")).toBeInTheDocument();

    await waitFor(() => {
      expect(apiMocks.getCurrentUser).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("Health section")).toBeInTheDocument();
  });
});
