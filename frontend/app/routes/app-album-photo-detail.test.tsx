import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "~/lib/i18n";
import AppAlbumPhotoDetailRoute, {
  clientLoader as appAlbumPhotoDetailClientLoader,
} from "~/routes/app-album-photo-detail";

const apiMocks = vi.hoisted(() => ({
  listAlbums: vi.fn(),
  listAllAlbumPhotos: vi.fn(),
  getPhotoBlob: vi.fn(),
}));

vi.mock("~/lib/api", () => ({
  ...apiMocks,
}));

describe("AppAlbumPhotoDetailRoute", () => {
  beforeEach(() => {
    apiMocks.listAlbums.mockResolvedValue([
      {
        id: "album-1",
        name: "Summer Week",
        description: "Pier, market, and long golden evenings",
        ownerId: "user-1",
        personalLibraryId: "library-1",
        spaceId: null,
        createdAt: "2026-04-01T10:00:00Z",
        updatedAt: "2026-04-05T18:30:00Z",
        coverPhotoId: "photo-1",
        coverVariants: [],
        photoCount: 1,
        mediaRangeStart: "2026-04-02T20:15:00Z",
        mediaRangeEnd: "2026-04-02T20:15:00Z",
        latestPhotoAddedAt: "2026-04-05T18:30:00Z",
      },
    ]);
    apiMocks.listAllAlbumPhotos.mockResolvedValue([
      {
        id: "photo-1",
        uploaderId: "user-1",
        originalFilename: "pier.jpg",
        mimeType: "image/jpeg",
        width: 1600,
        height: 900,
        sizeBytes: 320000,
        personalLibraryId: "library-1",
        exifData: '{"camera":"Phone"}',
        takenAt: "2026-04-02T20:15:00Z",
        latitude: null,
        longitude: null,
        createdAt: "2026-04-02T20:15:00Z",
        variants: [],
      },
    ]);
    apiMocks.getPhotoBlob.mockResolvedValue(
      new Blob(["preview"], { type: "image/jpeg" }),
    );
  });

  it("renders album photo metadata with album-context navigation", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/library/albums/:albumId/photos/:photoId",
        Component: AppAlbumPhotoDetailRoute,
        loader: async ({ params }) =>
          appAlbumPhotoDetailClientLoader({ params } as never),
      },
    ]);

    render(
      <I18nProvider>
        <Stub initialEntries={["/app/library/albums/album-1/photos/photo-1"]} />
      </I18nProvider>,
    );

    expect(await screen.findByText("pier.jpg")).toBeInTheDocument();
    expect(screen.getByText("Album context")).toBeInTheDocument();
    expect(screen.getByText("Summer Week")).toBeInTheDocument();
    expect(screen.getByText('{"camera":"Phone"}')).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /^back to album$/i }),
    ).toHaveAttribute("href", "/app/library/albums/album-1");
    expect(
      screen.getByRole("link", { name: /^back to albums$/i }),
    ).toHaveAttribute("href", "/app/library?view=albums");
  });
});
