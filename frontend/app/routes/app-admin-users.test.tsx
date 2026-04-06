import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppAdminUsersRoute, {
  clientAction as appAdminUsersClientAction,
  clientLoader as appAdminUsersClientLoader,
} from "~/routes/app-admin-users";

const apiMocks = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  listAdminUsers: vi.fn(),
  updateAdminUser: vi.fn(),
}));

const sessionMocks = vi.hoisted(() => ({
  useSession: vi.fn(),
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
  isBackendUnavailableError: vi.fn(() => false),
}));

vi.mock("~/lib/session", () => ({
  ...sessionMocks,
}));

describe("AppAdminUsersRoute", () => {
  beforeEach(() => {
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

    apiMocks.listAdminUsers.mockResolvedValue({
      items: [
        {
          id: "user-1",
          name: "Alice Example",
          email: "alice@example.com",
          avatarUrl: null,
          instanceRole: "USER",
          active: true,
          createdAt: "2026-04-01T10:00:00Z",
          updatedAt: "2026-04-02T10:00:00Z",
          providers: ["LOCAL"],
          photoCount: 3,
          storageBytesUsed: 4096,
        },
        {
          id: "user-2",
          name: "Bob Admin",
          email: "bob@example.com",
          avatarUrl: null,
          instanceRole: "ADMIN",
          active: false,
          createdAt: "2026-04-01T11:00:00Z",
          updatedAt: "2026-04-02T11:00:00Z",
          providers: ["LOCAL", "GOOGLE"],
          photoCount: 9,
          storageBytesUsed: 8192,
        },
      ],
      page: 0,
      size: 20,
      hasNext: false,
      totalItems: 2,
      totalPages: 1,
    });

    apiMocks.getAdminUser.mockImplementation(async (userId: string) => {
      if (userId === "user-2") {
        return {
          id: "user-2",
          name: "Bob Admin",
          email: "bob@example.com",
          avatarUrl: null,
          instanceRole: "ADMIN",
          active: false,
          createdAt: "2026-04-01T11:00:00Z",
          updatedAt: "2026-04-02T11:00:00Z",
          providers: ["LOCAL", "GOOGLE"],
          photoCount: 9,
          storageBytesUsed: 8192,
        };
      }

      return {
        id: "user-1",
        name: "Alice Example",
        email: "alice@example.com",
        avatarUrl: null,
        instanceRole: "USER",
        active: true,
        createdAt: "2026-04-01T10:00:00Z",
        updatedAt: "2026-04-02T10:00:00Z",
        providers: ["LOCAL"],
        photoCount: 3,
        storageBytesUsed: 4096,
      };
    });

    apiMocks.updateAdminUser.mockResolvedValue(undefined);
  });

  it("renders a paginated admin user list and selected user details", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/admin/users",
        Component: AppAdminUsersRoute,
        action: async ({ request }) =>
          appAdminUsersClientAction({ request } as never),
        loader: async ({ request }) =>
          appAdminUsersClientLoader({ request } as never),
      },
    ]);

    render(<Stub initialEntries={["/app/admin/users?user=user-2"]} />);

    expect(await screen.findByText("User management")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getAllByText("Bob Admin")).toHaveLength(2);
    expect(screen.getByLabelText("Instance role")).toHaveValue("ADMIN");
    expect(screen.getByLabelText("Account status")).toHaveValue("false");
  });

  it("updates a selected user and revalidates the detail panel", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/admin/users",
        Component: AppAdminUsersRoute,
        action: async ({ request }) =>
          appAdminUsersClientAction({ request } as never),
        loader: async ({ request }) =>
          appAdminUsersClientLoader({ request } as never),
      },
    ]);

    render(<Stub initialEntries={["/app/admin/users?user=user-1"]} />);

    expect((await screen.findAllByText("Alice Example")).length).toBe(2);

    fireEvent.change(screen.getByLabelText("Instance role"), {
      target: { value: "ADMIN" },
    });
    fireEvent.change(screen.getByLabelText("Account status"), {
      target: { value: "false" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(apiMocks.updateAdminUser).toHaveBeenCalledWith("user-1", {
        instanceRole: "ADMIN",
        active: false,
      });
    });

    expect(await screen.findByText("User updated.")).toBeInTheDocument();
  });

  it("shows an inline list error when the admin list request fails", async () => {
    apiMocks.listAdminUsers.mockRejectedValueOnce(
      new Error("Admin list failed"),
    );

    const Stub = createRoutesStub([
      {
        path: "/app/admin/users",
        Component: AppAdminUsersRoute,
        action: async ({ request }) =>
          appAdminUsersClientAction({ request } as never),
        loader: async ({ request }) =>
          appAdminUsersClientLoader({ request } as never),
      },
    ]);

    render(<Stub initialEntries={["/app/admin/users"]} />);

    expect(await screen.findByText("Admin list failed")).toBeInTheDocument();
  });
});
