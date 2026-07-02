import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "~/lib/i18n";
import AppAdminUsersRoute, {
  clientAction as usersClientAction,
  clientLoader as usersClientLoader,
} from "~/routes/app-admin-users";
import type { AdminUserDto } from "~/types/api";

const apiMocks = vi.hoisted(() => ({
  listAdminUsers: vi.fn(),
  updateAdminUser: vi.fn(),
  isBackendUnavailableError: vi.fn(() => false),
}));

const sessionMocks = vi.hoisted(() => ({
  useSession: vi.fn(),
}));

vi.mock("~/lib/api", () => ({
  ...apiMocks,
  ApiError: class ApiError extends Error {},
}));

vi.mock("~/lib/session", () => ({
  ...sessionMocks,
}));

function makeUser(overrides: Partial<AdminUserDto> = {}): AdminUserDto {
  return {
    id: "u-2",
    name: "Bob Ivanov",
    email: "bob@example.com",
    avatarUrl: null,
    instanceRole: "USER",
    active: true,
    createdAt: "2026-01-02T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    providers: ["LOCAL"],
    photoCount: 10,
    storageBytesUsed: 1024,
    ...overrides,
  };
}

function usersPage(items: AdminUserDto[]) {
  return {
    items,
    page: 0,
    size: 20,
    hasNext: false,
    totalItems: items.length,
    totalPages: 1,
  };
}

function renderRoute() {
  const Stub = createRoutesStub([
    {
      path: "/app/admin/users",
      Component: AppAdminUsersRoute,
      loader: (args) => usersClientLoader(args as never),
      action: (args) => usersClientAction(args as never),
    },
  ]);
  return render(
    <I18nProvider>
      <Stub initialEntries={["/app/admin/users"]} />
    </I18nProvider>,
  );
}

describe("AppAdminUsersRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.isBackendUnavailableError.mockReturnValue(false);
    apiMocks.updateAdminUser.mockResolvedValue({});
    sessionMocks.useSession.mockReturnValue({ user: { id: "admin-1" } });
    apiMocks.listAdminUsers.mockResolvedValue(
      usersPage([
        makeUser(),
        makeUser({ id: "u-3", name: "Alice Admin", instanceRole: "ADMIN" }),
      ]),
    );
  });

  it("renders the user table", async () => {
    renderRoute();
    expect(await screen.findByText("Bob Ivanov")).toBeInTheDocument();
    expect(screen.getByText("Alice Admin")).toBeInTheDocument();
    expect(screen.getAllByText("LOCAL").length).toBeGreaterThan(0);
    expect(screen.getAllByText("active").length).toBeGreaterThan(0);
  });

  it("grants the ADMIN role through the confirm dialog", async () => {
    renderRoute();
    await screen.findByText("Bob Ivanov");

    fireEvent.click(screen.getAllByRole("button", { name: "Make ADMIN" })[0]!);
    const dialog = screen.getByRole("alertdialog");
    expect(
      within(dialog).getByText("Grant administrator role?"),
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Grant ADMIN/ }),
    );

    await waitFor(() =>
      expect(apiMocks.updateAdminUser).toHaveBeenCalledWith("u-2", {
        instanceRole: "ADMIN",
        active: null,
      }),
    );
  });

  it("disables an account through the confirm dialog", async () => {
    renderRoute();
    await screen.findByText("Bob Ivanov");

    fireEvent.click(screen.getAllByRole("button", { name: "Disable" })[0]!);
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Disable account?")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Disable/ }));

    await waitFor(() =>
      expect(apiMocks.updateAdminUser).toHaveBeenCalledWith("u-2", {
        instanceRole: null,
        active: false,
      }),
    );
  });

  it("guards the current admin's own row", async () => {
    sessionMocks.useSession.mockReturnValue({ user: { id: "u-2" } });
    renderRoute();
    await screen.findByText("Bob Ivanov");

    expect(
      screen.getAllByRole("button", { name: "Make ADMIN" })[0],
    ).toBeDisabled();
  });

  it("shows a table error when the list fails", async () => {
    apiMocks.listAdminUsers.mockRejectedValue(new Error("boom"));
    renderRoute();
    expect(await screen.findByText("Failed to load data")).toBeInTheDocument();
  });
});
