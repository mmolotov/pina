import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppAdminInvitesRoute, {
  clientAction as appAdminInvitesClientAction,
  clientLoader as appAdminInvitesClientLoader,
} from "~/routes/app-admin-invites";

const apiMocks = vi.hoisted(() => ({
  listAdminInvites: vi.fn(),
  revokeAdminInvite: vi.fn(),
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

describe("AppAdminInvitesRoute", () => {
  beforeEach(() => {
    apiMocks.listAdminInvites.mockResolvedValue({
      items: [
        {
          id: "invite-1",
          code: "FAMILY-AAA",
          spaceId: "space-1",
          spaceName: "Family Archive",
          defaultRole: "MEMBER",
          expiration: "2026-04-10T10:00:00Z",
          usageLimit: 5,
          usageCount: 2,
          active: true,
          createdById: "user-1",
          createdByName: "Alice Example",
          createdAt: "2026-04-01T10:00:00Z",
        },
        {
          id: "invite-2",
          code: "EVENT-BBB",
          spaceId: "space-2",
          spaceName: "Event Highlights",
          defaultRole: "VIEWER",
          expiration: null,
          usageLimit: null,
          usageCount: 7,
          active: false,
          createdById: "user-2",
          createdByName: "Bob Admin",
          createdAt: "2026-04-01T11:00:00Z",
        },
      ],
      page: 0,
      size: 20,
      hasNext: false,
      totalItems: 2,
      totalPages: 1,
    });

    apiMocks.revokeAdminInvite.mockResolvedValue(undefined);
  });

  it("renders invite inventory and selected invite details", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/admin/invites",
        Component: AppAdminInvitesRoute,
        action: async ({ request }) =>
          appAdminInvitesClientAction({ request } as never),
        loader: async ({ request }) =>
          appAdminInvitesClientLoader({ request } as never),
      },
    ]);

    render(<Stub initialEntries={["/app/admin/invites?invite=invite-1"]} />);

    expect(await screen.findByText("Invite oversight")).toBeInTheDocument();
    expect(screen.getByText("Event Highlights")).toBeInTheDocument();
    expect(screen.getAllByText("Family Archive")).toHaveLength(2);
    expect(
      screen.getByRole("heading", { name: "Revoke invite" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open admin Space oversight" }),
    ).toHaveAttribute("href", "/app/admin/spaces?space=space-1");
  });

  it("revokes an invite and surfaces success feedback", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/admin/invites",
        Component: AppAdminInvitesRoute,
        action: async ({ request }) =>
          appAdminInvitesClientAction({ request } as never),
        loader: async ({ request }) =>
          appAdminInvitesClientLoader({ request } as never),
      },
    ]);

    render(<Stub initialEntries={["/app/admin/invites?invite=invite-1"]} />);

    expect((await screen.findAllByText("Family Archive")).length).toBe(2);

    fireEvent.click(screen.getByRole("button", { name: "Revoke invite" }));

    await waitFor(() => {
      expect(apiMocks.revokeAdminInvite).toHaveBeenCalledWith("invite-1");
    });

    expect(await screen.findByText("Invite revoked.")).toBeInTheDocument();
  });

  it("shows an inline list error when the admin invite request fails", async () => {
    apiMocks.listAdminInvites.mockRejectedValueOnce(
      new Error("Admin invite list failed"),
    );

    const Stub = createRoutesStub([
      {
        path: "/app/admin/invites",
        Component: AppAdminInvitesRoute,
        action: async ({ request }) =>
          appAdminInvitesClientAction({ request } as never),
        loader: async ({ request }) =>
          appAdminInvitesClientLoader({ request } as never),
      },
    ]);

    render(<Stub initialEntries={["/app/admin/invites"]} />);

    expect(
      await screen.findByText("Admin invite list failed"),
    ).toBeInTheDocument();
  });
});
