import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppSpacePhotoDetailRoute, {
  clientLoader as appSpacePhotoDetailClientLoader,
} from "~/routes/app-space-photo-detail";

const apiMocks = vi.hoisted(() => ({
  getSpace: vi.fn(),
  listAllSpaceAlbumPhotos: vi.fn(),
  getSpaceAlbumPhotoBlob: vi.fn(),
}));

vi.mock("~/lib/api", () => ({
  ...apiMocks,
}));

describe("AppSpacePhotoDetailRoute", () => {
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
        exifData: '{"camera":"Mirrorless"}',
        takenAt: "2026-04-01T20:00:00Z",
        createdAt: "2026-04-02T10:10:00Z",
        variants: [],
      },
    ]);
    apiMocks.getSpaceAlbumPhotoBlob.mockResolvedValue(
      new Blob(["test"], { type: "image/jpeg" }),
    );
  });

  it("renders shared photo metadata from a Space album", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/spaces/:spaceId/albums/:albumId/photos/:photoId",
        Component: AppSpacePhotoDetailRoute,
        loader: async ({ params }) =>
          appSpacePhotoDetailClientLoader({ params } as never),
      },
    ]);

    render(
      <Stub
        initialEntries={["/app/spaces/space-1/albums/album-1/photos/photo-2"]}
      />,
    );

    expect(await screen.findByText("campfire.jpg")).toBeInTheDocument();
    expect(screen.getByText("Shared asset details")).toBeInTheDocument();
    expect(screen.getByText('{"camera":"Mirrorless"}')).toBeInTheDocument();
    expect(screen.getAllByText("user-2")).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "Back to Family Space" }),
    ).toHaveAttribute("href", "/app/spaces/space-1");
    expect(
      screen.getByRole("link", { name: "Space overview" }),
    ).toHaveAttribute("href", "/app/spaces/space-1");
  });

  it("finds a shared photo from the fully loaded album list", async () => {
    apiMocks.listAllSpaceAlbumPhotos.mockResolvedValue([
      {
        id: "photo-1",
        uploaderId: "user-2",
        originalFilename: "earlier.jpg",
        mimeType: "image/jpeg",
        width: 1200,
        height: 800,
        sizeBytes: 120000,
        personalLibraryId: "library-2",
        exifData: null,
        takenAt: null,
        createdAt: "2026-04-02T10:05:00Z",
        variants: [],
      },
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

    const data = await appSpacePhotoDetailClientLoader({
      params: {
        spaceId: "space-1",
        albumId: "album-1",
        photoId: "photo-2",
      },
    } as never);

    expect(data.photo?.id).toBe("photo-2");
  });
});
