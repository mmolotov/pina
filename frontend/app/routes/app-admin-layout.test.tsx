import { render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "~/lib/i18n";
import AppAdminLayoutRoute from "~/routes/app-admin-layout";

const apiMocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listAdminUsers: vi.fn(),
  listAdminSpaces: vi.fn(),
  listAdminInvites: vi.fn(),
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

function countPage(totalItems: number) {
  return {
    items: [],
    page: 0,
    size: 1,
    hasNext: false,
    totalItems,
    totalPages: 1,
  };
}

function renderStub(
  initialEntries: string[],
  child?: { path: string; label: string },
) {
  const Stub = createRoutesStub([
    {
      path: "/app/admin",
      Component: AppAdminLayoutRoute,
      children: child
        ? [{ path: child.path, Component: () => <div>{child.label}</div> }]
        : undefined,
    },
  ]);
  return render(
    <I18nProvider>
      <Stub initialEntries={initialEntries} />
    </I18nProvider>,
  );
}

describe("AppAdminLayoutRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.listAdminUsers.mockResolvedValue(countPage(24));
    apiMocks.listAdminSpaces.mockResolvedValue(countPage(10));
    apiMocks.listAdminInvites.mockResolvedValue(countPage(8));
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

    renderStub(["/app/admin/users"], { path: "users", label: "Users section" });

    expect(await screen.findByText("Instance control")).toBeInTheDocument();
    expect(screen.getByText("Users section")).toBeInTheDocument();
    expect(screen.getByText("whole instance")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Users/i })).toHaveAttribute(
      "href",
      "/app/admin/users",
    );
    // nav count badge from the best-effort totals fetch
    expect(await screen.findByText("24")).toBeInTheDocument();
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

    renderStub(["/app/admin"]);

    expect(
      await screen.findByText("You do not have admin access"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to library" }),
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

    renderStub(["/app/admin/health"], {
      path: "health",
      label: "Health section",
    });

    expect(screen.getByText("Checking admin access")).toBeInTheDocument();

    await waitFor(() => {
      expect(apiMocks.getCurrentUser).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("Health section")).toBeInTheDocument();
  });
});
