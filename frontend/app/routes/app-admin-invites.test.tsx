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
import AppAdminInvitesRoute, {
  clientAction as invitesClientAction,
  clientLoader as invitesClientLoader,
} from "~/routes/app-admin-invites";
import type { AdminInviteLinkDto } from "~/types/api";

const apiMocks = vi.hoisted(() => ({
  listAdminInvites: vi.fn(),
  revokeAdminInvite: vi.fn(),
  isBackendUnavailableError: vi.fn(() => false),
}));

vi.mock("~/lib/api", () => ({
  ...apiMocks,
  ApiError: class ApiError extends Error {},
}));

function makeInvite(
  overrides: Partial<AdminInviteLinkDto> = {},
): AdminInviteLinkDto {
  return {
    id: "i-1",
    code: "ABCD1234",
    spaceId: "s-1",
    spaceName: "Family",
    defaultRole: "MEMBER",
    expiration: null,
    usageLimit: 10,
    usageCount: 3,
    active: true,
    createdById: "u-1",
    createdByName: "Owner One",
    createdAt: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

function invitesPage(items: AdminInviteLinkDto[]) {
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
      path: "/app/admin/invites",
      Component: AppAdminInvitesRoute,
      loader: (args) => invitesClientLoader(args as never),
      action: (args) => invitesClientAction(args as never),
    },
  ]);
  return render(
    <I18nProvider>
      <Stub initialEntries={["/app/admin/invites"]} />
    </I18nProvider>,
  );
}

describe("AppAdminInvitesRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.isBackendUnavailableError.mockReturnValue(false);
    apiMocks.revokeAdminInvite.mockResolvedValue(undefined);
    apiMocks.listAdminInvites.mockResolvedValue(
      invitesPage([
        makeInvite(),
        makeInvite({ id: "i-2", code: "REVOKED9", active: false }),
      ]),
    );
  });

  it("renders the invite table with statuses", async () => {
    renderRoute();
    expect(await screen.findByText("ABCD1234")).toBeInTheDocument();
    expect(screen.getByText("REVOKED9")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("revoked")).toBeInTheDocument();
  });

  it("filters invites by code with the search box", async () => {
    renderRoute();
    await screen.findByText("ABCD1234");

    fireEvent.change(screen.getByLabelText("Search invites"), {
      target: { value: "REVOKED" },
    });

    expect(screen.queryByText("ABCD1234")).not.toBeInTheDocument();
    expect(screen.getByText("REVOKED9")).toBeInTheDocument();
  });

  it("revokes an invite through the confirm dialog", async () => {
    renderRoute();
    await screen.findByText("ABCD1234");

    fireEvent.click(screen.getAllByRole("button", { name: "Revoke" })[0]!);
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Revoke invite?")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Revoke/ }));

    await waitFor(() =>
      expect(apiMocks.revokeAdminInvite).toHaveBeenCalledWith("i-1"),
    );
  });

  it("shows a table error when the list fails", async () => {
    apiMocks.listAdminInvites.mockRejectedValue(new Error("boom"));
    renderRoute();
    expect(await screen.findByText("Failed to load data")).toBeInTheDocument();
  });
});
