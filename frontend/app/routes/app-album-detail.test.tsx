import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "~/lib/i18n";
import AppAlbumDetailRoute, {
  clientAction as appAlbumDetailClientAction,
  clientLoader as appAlbumDetailClientLoader,
} from "~/routes/app-album-detail";
import AppAlbumPhotoDetailRoute, {
  clientLoader as appAlbumPhotoDetailClientLoader,
} from "~/routes/app-album-photo-detail";

const apiMocks = vi.hoisted(() => ({
  listAlbums: vi.fn(),
  listAllAlbumPhotos: vi.fn(),
  listAllPhotos: vi.fn(),
  listFavorites: vi.fn(),
  getPhotoBlob: vi.fn(),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  updateAlbum: vi.fn(),
  deleteAlbum: vi.fn(),
  addPhotoToAlbum: vi.fn(),
  removePhotoFromAlbum: vi.fn(),
  uploadPhoto: vi.fn(),
}));

vi.mock("~/lib/api", () => ({
  ...apiMocks,
}));

describe("AppAlbumDetailRoute", () => {
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
        photoCount: 2,
        mediaRangeStart: "2026-04-01T09:00:00Z",
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
      {
        id: "photo-2",
        uploaderId: "user-1",
        originalFilename: "market.jpg",
        mimeType: "image/jpeg",
        width: 1600,
        height: 900,
        sizeBytes: 300000,
        personalLibraryId: "library-1",
        exifData: null,
        takenAt: "2026-04-01T09:00:00Z",
        latitude: null,
        longitude: null,
        createdAt: "2026-04-01T09:00:00Z",
        variants: [],
      },
    ]);
    apiMocks.listAllPhotos.mockResolvedValue([
      {
        id: "photo-1",
        uploaderId: "user-1",
        originalFilename: "pier.jpg",
        mimeType: "image/jpeg",
        width: 1600,
        height: 900,
        sizeBytes: 320000,
        personalLibraryId: "library-1",
        exifData: null,
        takenAt: "2026-04-02T20:15:00Z",
        latitude: null,
        longitude: null,
        createdAt: "2026-04-02T20:15:00Z",
        variants: [],
      },
      {
        id: "photo-3",
        uploaderId: "user-1",
        originalFilename: "lanterns.jpg",
        mimeType: "image/jpeg",
        width: 1600,
        height: 900,
        sizeBytes: 290000,
        personalLibraryId: "library-1",
        exifData: null,
        takenAt: "2026-04-03T21:00:00Z",
        latitude: null,
        longitude: null,
        createdAt: "2026-04-03T21:00:00Z",
        variants: [],
      },
    ]);
    apiMocks.listFavorites.mockResolvedValue([]);
    apiMocks.getPhotoBlob.mockResolvedValue(
      new Blob(["thumb"], { type: "image/jpeg" }),
    );
    apiMocks.addFavorite.mockResolvedValue(undefined);
    apiMocks.removeFavorite.mockResolvedValue(undefined);
    apiMocks.updateAlbum.mockResolvedValue(undefined);
    apiMocks.deleteAlbum.mockResolvedValue(undefined);
    apiMocks.addPhotoToAlbum.mockResolvedValue(undefined);
    apiMocks.removePhotoFromAlbum.mockResolvedValue(undefined);
    apiMocks.uploadPhoto.mockResolvedValue(undefined);
  });

  function renderRoute(initialEntry = "/app/library/albums/album-1") {
    const Stub = createRoutesStub([
      {
        path: "/app/library/albums/:albumId",
        Component: AppAlbumDetailRoute,
        action: async ({ request, params }) =>
          appAlbumDetailClientAction({ request, params } as never),
        loader: async ({ params }) =>
          appAlbumDetailClientLoader({ params } as never),
      },
      {
        path: "/app/library/albums/:albumId/photos/:photoId",
        Component: AppAlbumPhotoDetailRoute,
        loader: async ({ params }) =>
          appAlbumPhotoDetailClientLoader({ params } as never),
      },
    ]);

    return render(
      <I18nProvider>
        <Stub initialEntries={[initialEntry]} />
      </I18nProvider>,
    );
  }

  it("renders album detail and navigates into the album photo route", async () => {
    renderRoute();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Summer Week" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pier, market, and long golden evenings")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to albums|назад к альбомам/i }),
    ).toHaveAttribute("href", "/app/library?view=albums");
    expect(screen.getAllByText(/pier\.jpg/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("link", { name: /pier\.jpg/i })[0]!);

    await waitFor(() => {
      expect(screen.getByText("Album context")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("link", { name: /^back to album$/i }),
    ).toHaveAttribute("href", "/app/library/albums/album-1");
  });

  it("renders the empty album state", async () => {
    apiMocks.listAllAlbumPhotos.mockResolvedValue([]);
    apiMocks.listAlbums.mockResolvedValue([
      {
        id: "album-1",
        name: "Empty Album",
        description: null,
        ownerId: "user-1",
        personalLibraryId: "library-1",
        spaceId: null,
        createdAt: "2026-04-01T10:00:00Z",
        updatedAt: "2026-04-01T10:00:00Z",
        coverPhotoId: null,
        coverVariants: [],
        photoCount: 0,
        mediaRangeStart: null,
        mediaRangeEnd: null,
        latestPhotoAddedAt: null,
      },
    ]);

    renderRoute();

    expect(
      await screen.findByText(/no photos in this album yet|в этом альбоме пока нет фото/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /add photos|добавить фото/i })[0],
    ).toBeInTheDocument();
  });
});
