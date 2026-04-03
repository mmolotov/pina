import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  listAllSpaceAlbumPhotos: vi.fn(),
  listAllPhotos: vi.fn(),
  addSpaceMember: vi.fn(),
  changeSpaceMemberRole: vi.fn(),
  removeSpaceMember: vi.fn(),
  createSubspace: vi.fn(),
  createSpaceAlbum: vi.fn(),
  updateSpaceAlbum: vi.fn(),
  deleteSpaceAlbum: vi.fn(),
  addPhotoToSpaceAlbum: vi.fn(),
  removePhotoFromSpaceAlbum: vi.fn(),
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
      createdAt: "2026-04-02T10:00:00Z",
      updatedAt: "2026-04-02T10:00:00Z",
    });
    apiMocks.listSpaceMembers.mockResolvedValue([
      {
        userId: "user-1",
        userName: "Owner User",
        userAvatarUrl: null,
        role: "OWNER",
        joinedAt: "2026-04-02T10:00:00Z",
      },
    ]);
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
      },
    ]);
    apiMocks.listAllSpaceAlbumPhotos.mockResolvedValue([
      {
        id: "photo-2",
        uploaderId: "user-2",
        originalFilename: "campfire.jpg",
        mimeType: "image/jpeg",
        width: 1400,
        height: 900,
        sizeBytes: 220000,
        personalLibraryId: "library-2",
        exifData: null,
        takenAt: null,
        createdAt: "2026-04-02T10:10:00Z",
        variants: [],
      },
    ]);
    apiMocks.listAllPhotos.mockResolvedValue([
      {
        id: "photo-1",
        uploaderId: "user-1",
        originalFilename: "sunset.jpg",
        mimeType: "image/jpeg",
        width: 1600,
        height: 900,
        sizeBytes: 320000,
        personalLibraryId: "library-1",
        exifData: null,
        takenAt: null,
        createdAt: "2026-04-02T10:00:00Z",
        variants: [],
      },
    ]);
    apiMocks.addSpaceMember.mockResolvedValue(undefined);
    apiMocks.changeSpaceMemberRole.mockResolvedValue(undefined);
    apiMocks.removeSpaceMember.mockResolvedValue(undefined);
    apiMocks.createSubspace.mockResolvedValue(undefined);
    apiMocks.createSpaceAlbum.mockResolvedValue(undefined);
    apiMocks.updateSpaceAlbum.mockResolvedValue(undefined);
    apiMocks.deleteSpaceAlbum.mockResolvedValue(undefined);
    apiMocks.addPhotoToSpaceAlbum.mockResolvedValue(undefined);
    apiMocks.removePhotoFromSpaceAlbum.mockResolvedValue(undefined);
    apiMocks.createSpaceInvite.mockResolvedValue(undefined);
    apiMocks.revokeSpaceInvite.mockResolvedValue(undefined);
  });

  it("loads the Space detail and creates a new invite", async () => {
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

    render(<Stub initialEntries={["/app/spaces/space-1"]} />);

    expect(await screen.findByText("Family Space")).toBeInTheDocument();
    expect(screen.getByText("Owner User")).toBeInTheDocument();
    expect(screen.getByText("JOIN-123")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Invite default role"), {
      target: { value: "MEMBER" },
    });
    fireEvent.change(screen.getByPlaceholderText("Usage limit"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create invite" }));

    await waitFor(() => {
      expect(apiMocks.createSpaceInvite).toHaveBeenCalledWith("space-1", {
        defaultRole: "MEMBER",
        expiration: null,
        usageLimit: 3,
      });
    });
  });

  it("creates a Space album and adds a personal photo to it", async () => {
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

    render(<Stub initialEntries={["/app/spaces/space-1"]} />);

    expect(
      (await screen.findAllByText("Weekend highlights")).length,
    ).toBeGreaterThan(0);

    fireEvent.change(screen.getAllByLabelText("New album name")[0], {
      target: { value: "Roadtrip" },
    });
    fireEvent.change(screen.getAllByLabelText("New album description")[0], {
      target: { value: "New shared album" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Create album" })[0]);

    await waitFor(() => {
      expect(apiMocks.createSpaceAlbum).toHaveBeenCalledWith("space-1", {
        name: "Roadtrip",
        description: "New shared album",
      });
    });

    fireEvent.change(screen.getAllByLabelText("Photo for album")[0], {
      target: { value: "photo-1" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Add photo" })[0]);

    await waitFor(() => {
      expect(apiMocks.addPhotoToSpaceAlbum).toHaveBeenCalledWith(
        "space-1",
        "album-1",
        "photo-1",
      );
    });

    expect(screen.getByRole("link", { name: "Preview" })).toHaveAttribute(
      "href",
      "/app/spaces/space-1/albums/album-1/photos/photo-2",
    );
  });

  it("changes a member role and revokes an invite through route actions", async () => {
    apiMocks.listSpaceMembers.mockResolvedValue([
      {
        userId: "user-1",
        userName: "Owner User",
        userAvatarUrl: null,
        role: "OWNER",
        joinedAt: "2026-04-02T10:00:00Z",
      },
      {
        userId: "user-2",
        userName: "Member User",
        userAvatarUrl: null,
        role: "VIEWER",
        joinedAt: "2026-04-02T10:05:00Z",
      },
    ]);

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

    render(<Stub initialEntries={["/app/spaces/space-1"]} />);

    expect(await screen.findByText("Member User")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Role for Member User"), {
      target: { value: "MEMBER" },
    });

    await waitFor(() => {
      expect(apiMocks.changeSpaceMemberRole).toHaveBeenCalledWith(
        "space-1",
        "user-2",
        "MEMBER",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));

    await waitFor(() => {
      expect(apiMocks.revokeSpaceInvite).toHaveBeenCalledWith(
        "space-1",
        "invite-1",
      );
    });
  });

  it("filters local Space detail sections without changing backend data", async () => {
    apiMocks.listSpaceMembers.mockResolvedValue([
      {
        userId: "user-1",
        userName: "Owner User",
        userAvatarUrl: null,
        role: "OWNER",
        joinedAt: "2026-04-02T10:00:00Z",
      },
      {
        userId: "user-2",
        userName: "Guest Member",
        userAvatarUrl: null,
        role: "VIEWER",
        joinedAt: "2026-04-02T10:05:00Z",
      },
    ]);
    apiMocks.listSubspaces.mockResolvedValue([
      {
        id: "space-child-1",
        name: "Archive Wing",
        description: "Old material",
        avatarUrl: null,
        visibility: "PRIVATE",
        parentId: "space-1",
        depth: 1,
        inheritMembers: true,
        creatorId: "user-1",
        createdAt: "2026-04-02T10:00:00Z",
        updatedAt: "2026-04-02T10:00:00Z",
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
      },
      {
        id: "album-2",
        name: "Archive album",
        description: "Older shared material",
        ownerId: "user-1",
        personalLibraryId: null,
        spaceId: "space-1",
        createdAt: "2026-04-02T10:00:00Z",
        updatedAt: "2026-04-02T10:00:00Z",
      },
    ]);
    apiMocks.listAllPhotos.mockResolvedValue([
      {
        id: "photo-2",
        uploaderId: "user-2",
        originalFilename: "campfire.jpg",
        mimeType: "image/jpeg",
        width: 1400,
        height: 900,
        sizeBytes: 220000,
        personalLibraryId: "library-2",
        exifData: null,
        takenAt: null,
        createdAt: "2026-04-02T10:10:00Z",
        variants: [],
      },
    ]);

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

    render(<Stub initialEntries={["/app/spaces/space-1"]} />);

    expect(await screen.findByText("Guest Member")).toBeInTheDocument();
    expect(screen.getByText("Archive Wing")).toBeInTheDocument();
    expect(screen.getByText("Archive album")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter Space detail"), {
      target: { value: "archive" },
    });

    expect(screen.queryByText("Guest Member")).not.toBeInTheDocument();
    expect(screen.getByText("Archive Wing")).toBeInTheDocument();
    expect(screen.getByText("Archive album")).toBeInTheDocument();
    expect(
      screen.getByText("No members match the current filter."),
    ).toBeInTheDocument();
  });
});
