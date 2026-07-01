import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "~/lib/i18n";
import AppSpaceAlbumDetailRoute, {
  clientAction as albumClientAction,
  clientLoader as albumClientLoader,
} from "~/routes/app-space-album-detail";

const apiMocks = vi.hoisted(() => ({
  getSpace: vi.fn(),
  listSpaceAlbums: vi.fn(),
  listAllSpaceAlbumPhotos: vi.fn(),
  listAllPhotos: vi.fn(),
  addPhotoToSpaceAlbum: vi.fn(),
  removePhotoFromSpaceAlbum: vi.fn(),
  updateSpaceAlbum: vi.fn(),
  deleteSpaceAlbum: vi.fn(),
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

function renderAlbum() {
  const Stub = createRoutesStub([
    {
      path: "/app/spaces/:spaceId/albums/:albumId",
      Component: AppSpaceAlbumDetailRoute,
      action: async ({ params, request }) =>
        albumClientAction({ params, request } as never),
      loader: async ({ params }) => albumClientLoader({ params } as never),
    },
  ]);
  return render(
    <I18nProvider>
      <Stub initialEntries={["/app/spaces/space-1/albums/album-1"]} />
    </I18nProvider>,
  );
}

describe("AppSpaceAlbumDetailRoute", () => {
  beforeEach(() => {
    apiMocks.getSpace.mockResolvedValue({
      id: "space-1",
      name: "Family Space",
      description: null,
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
        photoCount: 1,
        mediaRangeStart: null,
        mediaRangeEnd: null,
        latestPhotoAddedAt: null,
        previewPhotos: [],
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
        latitude: null,
        longitude: null,
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
        latitude: null,
        longitude: null,
        createdAt: "2026-04-02T10:00:00Z",
        variants: [],
      },
    ]);
    apiMocks.addPhotoToSpaceAlbum.mockResolvedValue(undefined);
  });

  it("shows album photos and adds one from the personal library", async () => {
    renderAlbum();

    expect(
      await screen.findByRole("heading", { name: "Weekend highlights" }),
    ).toBeInTheDocument();
    expect(screen.getByText("campfire.jpg")).toBeInTheDocument();

    // Library photos load asynchronously into the picker.
    await screen.findByRole("option", { name: "sunset.jpg" });
    fireEvent.change(screen.getByLabelText("Add a photo"), {
      target: { value: "photo-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add photo" }));

    await waitFor(() => {
      expect(apiMocks.addPhotoToSpaceAlbum).toHaveBeenCalledWith(
        "space-1",
        "album-1",
        "photo-1",
      );
    });
  });
});
