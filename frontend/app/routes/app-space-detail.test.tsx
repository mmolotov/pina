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
import AppSpaceDetailRoute, {
  clientAction as appSpaceDetailClientAction,
  clientLoader as appSpaceDetailClientLoader,
} from "~/routes/app-space-detail";

const apiMocks = vi.hoisted(() => ({
  getSpace: vi.fn(),
  listSpaceMembers: vi.fn(),
  listSubspaces: vi.fn(),
  listSpaceInvites: vi.fn(),
  listSpaceAlbums: vi.fn(),
  addSpaceMember: vi.fn(),
  changeSpaceMemberRole: vi.fn(),
  removeSpaceMember: vi.fn(),
  createSubspace: vi.fn(),
  createSpaceAlbum: vi.fn(),
  createSpaceInvite: vi.fn(),
  revokeSpaceInvite: vi.fn(),
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

const OWNER = {
  userId: "user-1",
  userName: "Owner User",
  userAvatarUrl: null,
  role: "OWNER",
  joinedAt: "2026-04-02T10:00:00Z",
};

function renderDetail() {
  const Stub = createRoutesStub([
    {
      path: "/app/spaces/:spaceId",
      Component: AppSpaceDetailRoute,
      action: async ({ params, request }) =>
        appSpaceDetailClientAction({ params, request } as never),
      loader: async ({ params }) =>
        appSpaceDetailClientLoader({ params } as never),
    },
  ]);
  return render(
    <I18nProvider>
      <Stub initialEntries={["/app/spaces/space-1"]} />
    </I18nProvider>,
  );
}

describe("AppSpaceDetailRoute", () => {
  beforeEach(() => {
    apiMocks.getSpace.mockResolvedValue({
      id: "space-1",
      name: "Family Space",
      description: "Shared family media",
      avatarUrl: null,
      visibility: "PRIVATE",
      parentId: null,
      depth: 0,
      inheritMembers: true,
      creatorId: "user-1",
      myRole: "OWNER",
      memberCount: 1,
      albumCount: 1,
      createdAt: "2026-04-02T10:00:00Z",
      updatedAt: "2026-04-02T10:00:00Z",
    });
    apiMocks.listSpaceMembers.mockResolvedValue([OWNER]);
    apiMocks.listSubspaces.mockResolvedValue([]);
    apiMocks.listSpaceInvites.mockResolvedValue([
      {
        id: "invite-1",
        code: "JOIN-123",
        defaultRole: "VIEWER",
        expiration: null,
        usageLimit: 5,
        usageCount: 0,
        active: true,
        createdById: "user-1",
        createdAt: "2026-04-02T10:00:00Z",
      },
    ]);
    apiMocks.listSpaceAlbums.mockResolvedValue([
      {
        id: "album-1",
        name: "Weekend highlights",
        description: "Shared shots",
        ownerId: "user-1",
        personalLibraryId: null,
        spaceId: "space-1",
        createdAt: "2026-04-02T10:00:00Z",
        updatedAt: "2026-04-02T10:00:00Z",
        coverPhotoId: null,
        coverVariants: [],
        photoCount: 4,
        mediaRangeStart: null,
        mediaRangeEnd: null,
        latestPhotoAddedAt: null,
        previewPhotos: [],
      },
    ]);
    apiMocks.createSpaceInvite.mockResolvedValue(undefined);
    apiMocks.revokeSpaceInvite.mockResolvedValue(undefined);
    apiMocks.changeSpaceMemberRole.mockResolvedValue(undefined);
  });

  it("renders the hero and links album cards to the album route", async () => {
    renderDetail();

    expect(
      await screen.findByRole("heading", { name: "Family Space" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open album Weekend highlights" }),
    ).toHaveAttribute("href", "/app/spaces/space-1/albums/album-1");

    fireEvent.click(screen.getByRole("tab", { name: /Members/ }));
    expect(screen.getByText("Just you")).toBeInTheDocument();
  });

  it("creates an invite from the hero action", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: "Family Space" });

    fireEvent.click(screen.getByRole("button", { name: "Invite" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText(/50/), {
      target: { value: "3" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create invite" }),
    );

    await waitFor(() => {
      expect(apiMocks.createSpaceInvite).toHaveBeenCalledWith("space-1", {
        defaultRole: "MEMBER",
        expiration: null,
        usageLimit: 3,
      });
    });
  });

  it("changes a member role from the members tab", async () => {
    apiMocks.listSpaceMembers.mockResolvedValue([
      OWNER,
      {
        userId: "user-2",
        userName: "Member User",
        userAvatarUrl: null,
        role: "VIEWER",
        joinedAt: "2026-04-02T10:05:00Z",
      },
    ]);

    renderDetail();
    await screen.findByRole("heading", { name: "Family Space" });

    fireEvent.click(screen.getByRole("tab", { name: /Members/ }));
    expect(screen.getByText("Member User")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Role"), {
      target: { value: "MEMBER" },
    });

    await waitFor(() => {
      expect(apiMocks.changeSpaceMemberRole).toHaveBeenCalledWith(
        "space-1",
        "user-2",
        "MEMBER",
      );
    });
  });

  it("revokes an invite from the invites tab", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: "Family Space" });

    fireEvent.click(screen.getByRole("tab", { name: /Invites/ }));
    expect(screen.getByText("JOIN-123")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke" }));

    await waitFor(() => {
      expect(apiMocks.revokeSpaceInvite).toHaveBeenCalledWith(
        "space-1",
        "invite-1",
      );
    });
  });
});
