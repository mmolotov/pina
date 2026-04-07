import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "~/lib/i18n";
import AppLibraryRoute, {
  clientAction as appLibraryClientAction,
  clientLoader as appLibraryClientLoader,
} from "~/routes/app-library";

const apiMocks = vi.hoisted(() => ({
  listAllPhotos: vi.fn(),
  listAlbums: vi.fn(),
  listAllAlbumPhotos: vi.fn(),
  listGeoPhotos: vi.fn(),
  getPhotoBlob: vi.fn(),
  uploadPhoto: vi.fn(),
  deletePhoto: vi.fn(),
  createAlbum: vi.fn(),
  updateAlbum: vi.fn(),
  deleteAlbum: vi.fn(),
  addPhotoToAlbum: vi.fn(),
  removePhotoFromAlbum: vi.fn(),
  listFavorites: vi.fn(),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
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

describe("AppLibraryRoute", () => {
  beforeEach(() => {
    apiMocks.listAllPhotos.mockResolvedValue([
      {
        id: "photo-1",
        uploaderId: "user-1",
        originalFilename: "beach.jpg",
        mimeType: "image/jpeg",
        width: 1920,
        height: 1080,
        sizeBytes: 512000,
        personalLibraryId: "library-1",
        exifData: null,
        takenAt: null,
        createdAt: "2026-04-02T10:05:00Z",
        variants: [],
      },
    ]);
    apiMocks.listAlbums.mockResolvedValue([]);
    apiMocks.listAllAlbumPhotos.mockResolvedValue([]);
    apiMocks.listGeoPhotos.mockResolvedValue({
      items: [],
      page: 0,
      size: 100,
      hasNext: false,
      totalItems: 0,
      totalPages: 0,
    });
    apiMocks.getPhotoBlob.mockResolvedValue(
      new Blob(["thumb"], { type: "image/jpeg" }),
    );
    apiMocks.listFavorites.mockImplementation(async (targetType?: string) => {
      if (targetType === "PHOTO") {
        return [];
      }
      if (targetType === "ALBUM") {
        return [];
      }
      return [];
    });
    apiMocks.addFavorite.mockResolvedValue(undefined);
    apiMocks.removeFavorite.mockResolvedValue(undefined);
    apiMocks.uploadPhoto.mockResolvedValue(undefined);
    apiMocks.deletePhoto.mockResolvedValue(undefined);
    apiMocks.createAlbum.mockResolvedValue(undefined);
    apiMocks.updateAlbum.mockResolvedValue(undefined);
    apiMocks.deleteAlbum.mockResolvedValue(undefined);
    apiMocks.addPhotoToAlbum.mockResolvedValue(undefined);
    apiMocks.removePhotoFromAlbum.mockResolvedValue(undefined);
  });

  function renderRoute(initialEntry = "/app/library") {
    const Stub = createRoutesStub([
      {
        path: "/app/library",
        Component: AppLibraryRoute,
        action: async ({ request }) =>
          appLibraryClientAction({ request } as never),
        loader: async () => appLibraryClientLoader(),
      },
    ]);

    return render(
      <I18nProvider>
        <Stub initialEntries={[initialEntry]} />
      </I18nProvider>,
    );
  }

  it("adds a photo to favorites from the library grid", async () => {
    renderRoute();

    expect(await screen.findByText("beach.jpg")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Add beach.jpg to favorites" }),
    );

    await waitFor(() => {
      expect(apiMocks.addFavorite).toHaveBeenCalledWith("PHOTO", "photo-1");
    });
  });

  it("switches to albums-only view", async () => {
    renderRoute();

    expect(await screen.findByText("beach.jpg")).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole("button", { name: /albums|альбомы/i })[0]!,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: /name|название/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /spaces/i })).toBeInTheDocument();
  });

  it("switches to timeline view and groups photos by day", async () => {
    apiMocks.listAllPhotos.mockResolvedValue([
      {
        id: "photo-1",
        uploaderId: "user-1",
        originalFilename: "beach.jpg",
        mimeType: "image/jpeg",
        width: 1920,
        height: 1080,
        sizeBytes: 512000,
        personalLibraryId: "library-1",
        exifData: null,
        takenAt: null,
        createdAt: "2026-04-02T10:05:00Z",
        variants: [],
      },
      {
        id: "photo-2",
        uploaderId: "user-1",
        originalFilename: "dinner.jpg",
        mimeType: "image/jpeg",
        width: 1600,
        height: 900,
        sizeBytes: 320000,
        personalLibraryId: "library-1",
        exifData: null,
        takenAt: "2026-04-01T20:15:00Z",
        createdAt: "2026-04-01T20:15:00Z",
        variants: [],
      },
    ]);

    renderRoute();

    expect(await screen.findByText("beach.jpg")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /timeline|таймлайн/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /timeline|таймлайн/i }),
      ).toHaveAttribute("aria-pressed", "true");
    });
    expect(
      screen.getByRole("button", { name: /Apr 2026/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("dinner.jpg")).toBeInTheDocument();
  });

  it("loads geo markers from URL viewport state in map view", async () => {
    apiMocks.listGeoPhotos.mockResolvedValue({
      items: [
        {
          id: "photo-map-1",
          uploaderId: "user-1",
          originalFilename: "belgrade.jpg",
          mimeType: "image/jpeg",
          width: 1600,
          height: 900,
          sizeBytes: 256000,
          personalLibraryId: "library-1",
          exifData: null,
          takenAt: "2026-04-03T09:15:00Z",
          latitude: 44.8176,
          longitude: 20.4633,
          createdAt: "2026-04-03T09:15:00Z",
          variants: [],
        },
      ],
      page: 0,
      size: 100,
      hasNext: false,
      totalItems: 1,
      totalPages: 1,
    });

    renderRoute("/app/library?view=map&swLat=44&swLng=20&neLat=45&neLng=21");

    expect(await screen.findByText("belgrade.jpg")).toBeInTheDocument();

    await waitFor(() => {
      expect(apiMocks.listGeoPhotos).toHaveBeenCalledWith({
        swLat: 44,
        swLng: 20,
        neLat: 45,
        neLng: 21,
        page: 0,
        size: 100,
        needsTotal: true,
      });
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Open map marker for belgrade.jpg",
      }),
    );

    expect(screen.getByText(/photo selected/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open photo detail" }),
    ).toHaveAttribute("href", "/app/library/photos/photo-map-1");
  });

  it("renders dense geo markers as a cluster and supports zooming in", async () => {
    apiMocks.listGeoPhotos
      .mockResolvedValueOnce({
        items: [
          {
            id: "photo-map-1",
            uploaderId: "user-1",
            originalFilename: "cluster-a.jpg",
            mimeType: "image/jpeg",
            width: 1600,
            height: 900,
            sizeBytes: 256000,
            personalLibraryId: "library-1",
            exifData: null,
            takenAt: "2026-04-03T09:15:00Z",
            latitude: 44.8176,
            longitude: 20.4633,
            createdAt: "2026-04-03T09:15:00Z",
            variants: [],
          },
          {
            id: "photo-map-2",
            uploaderId: "user-1",
            originalFilename: "cluster-b.jpg",
            mimeType: "image/jpeg",
            width: 1600,
            height: 900,
            sizeBytes: 256000,
            personalLibraryId: "library-1",
            exifData: null,
            takenAt: "2026-04-03T09:17:00Z",
            latitude: 44.8179,
            longitude: 20.4636,
            createdAt: "2026-04-03T09:17:00Z",
            variants: [],
          },
        ],
        page: 0,
        size: 100,
        hasNext: false,
        totalItems: 2,
        totalPages: 1,
      })
      .mockResolvedValue({
        items: [
          {
            id: "photo-map-1",
            uploaderId: "user-1",
            originalFilename: "cluster-a.jpg",
            mimeType: "image/jpeg",
            width: 1600,
            height: 900,
            sizeBytes: 256000,
            personalLibraryId: "library-1",
            exifData: null,
            takenAt: "2026-04-03T09:15:00Z",
            latitude: 44.8176,
            longitude: 20.4633,
            createdAt: "2026-04-03T09:15:00Z",
            variants: [],
          },
        ],
        page: 0,
        size: 100,
        hasNext: false,
        totalItems: 1,
        totalPages: 1,
      });

    renderRoute("/app/library?view=map&swLat=44&swLng=20&neLat=45&neLng=21");

    const clusterButton = await screen.findByRole("button", {
      name: /cluster.*2/i,
    });
    fireEvent.click(clusterButton);

    expect(await screen.findByText(/cluster.*2/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /zoom.*cluster/i }));

    await waitFor(() => {
      expect(apiMocks.listGeoPhotos).toHaveBeenCalledTimes(3);
    });
  });

  it("updates the viewport query when panning the map", async () => {
    apiMocks.listGeoPhotos.mockResolvedValue({
      items: [],
      page: 0,
      size: 100,
      hasNext: false,
      totalItems: 0,
      totalPages: 0,
    });

    renderRoute("/app/library?view=map&swLat=10&swLng=20&neLat=30&neLng=40");

    expect(
      await screen.findByRole("button", { name: /east|восток/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /east|восток/i }));

    await waitFor(() => {
      expect(apiMocks.listGeoPhotos).toHaveBeenLastCalledWith({
        swLat: 10,
        swLng: 25,
        neLat: 30,
        neLng: 45,
        page: 0,
        size: 100,
        needsTotal: true,
      });
    });
  });

  it("shows a clear map error state when geo loading fails", async () => {
    apiMocks.listGeoPhotos.mockRejectedValue(new Error("Geo endpoint failed"));

    renderRoute("/app/library?view=map");
    expect(await screen.findByText("Geo endpoint failed")).toBeInTheDocument();
  });

  it("applies the current library filter to map markers and empty states", async () => {
    apiMocks.listAllPhotos.mockResolvedValue([
      {
        id: "photo-map-1",
        uploaderId: "user-1",
        originalFilename: "belgrade.jpg",
        mimeType: "image/jpeg",
        width: 1600,
        height: 900,
        sizeBytes: 256000,
        personalLibraryId: "library-1",
        exifData: null,
        takenAt: "2026-04-03T09:15:00Z",
        latitude: 44.8176,
        longitude: 20.4633,
        createdAt: "2026-04-03T09:15:00Z",
        variants: [],
      },
      {
        id: "photo-map-2",
        uploaderId: "user-1",
        originalFilename: "forest.png",
        mimeType: "image/png",
        width: 1600,
        height: 900,
        sizeBytes: 256000,
        personalLibraryId: "library-1",
        exifData: null,
        takenAt: "2026-04-03T10:15:00Z",
        latitude: -33.8688,
        longitude: 151.2093,
        createdAt: "2026-04-03T10:15:00Z",
        variants: [],
      },
    ]);
    apiMocks.listGeoPhotos.mockResolvedValue({
      items: [
        {
          id: "photo-map-1",
          uploaderId: "user-1",
          originalFilename: "belgrade.jpg",
          mimeType: "image/jpeg",
          width: 1600,
          height: 900,
          sizeBytes: 256000,
          personalLibraryId: "library-1",
          exifData: null,
          takenAt: "2026-04-03T09:15:00Z",
          latitude: 44.8176,
          longitude: 20.4633,
          createdAt: "2026-04-03T09:15:00Z",
          variants: [],
        },
        {
          id: "photo-map-2",
          uploaderId: "user-1",
          originalFilename: "forest.png",
          mimeType: "image/png",
          width: 1600,
          height: 900,
          sizeBytes: 256000,
          personalLibraryId: "library-1",
          exifData: null,
          takenAt: "2026-04-03T10:15:00Z",
          latitude: -33.8688,
          longitude: 151.2093,
          createdAt: "2026-04-03T10:15:00Z",
          variants: [],
        },
      ],
      page: 0,
      size: 100,
      hasNext: false,
      totalItems: 2,
      totalPages: 1,
    });

    renderRoute("/app/library?view=map");
    expect(
      await screen.findByRole("button", {
        name: /belgrade\.jpg/i,
      }),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByLabelText(/filter library|фильтр библиотеки/i),
      {
        target: { value: "forest" },
      },
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("button", {
          name: /belgrade\.jpg/i,
        }),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /forest\.png/i }),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByLabelText(/filter library|фильтр библиотеки/i),
      {
        target: { value: "desert" },
      },
    );

    expect(
      await screen.findByRole("heading", {
        name: /geo-tagged photos match|фото с геотегами/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /clear filter|сбросить фильтр/i })
        .length,
    ).toBeGreaterThan(0);
  });

  it("supports clearing the current map selection", async () => {
    apiMocks.listGeoPhotos.mockResolvedValue({
      items: [
        {
          id: "photo-map-1",
          uploaderId: "user-1",
          originalFilename: "belgrade.jpg",
          mimeType: "image/jpeg",
          width: 1600,
          height: 900,
          sizeBytes: 256000,
          personalLibraryId: "library-1",
          exifData: null,
          takenAt: "2026-04-03T09:15:00Z",
          latitude: 44.8176,
          longitude: 20.4633,
          createdAt: "2026-04-03T09:15:00Z",
          variants: [],
        },
      ],
      page: 0,
      size: 100,
      hasNext: false,
      totalItems: 1,
      totalPages: 1,
    });

    renderRoute("/app/library?view=map");

    fireEvent.click(
      await screen.findByRole("button", {
        name: /belgrade\.jpg/i,
      }),
    );

    expect(
      await screen.findByText(/photo selected|фото выбрано/i),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /clear selection|снять выделение/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/nothing selected|ничего не выбрано/i),
      ).toBeInTheDocument();
    });
  });

  it("creates a new album through the route action", async () => {
    renderRoute();

    expect(await screen.findByText("beach.jpg")).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole("button", { name: /albums|альбомы/i })[0]!,
    );
    fireEvent.change(screen.getByLabelText(/name|название/i), {
      target: { value: "Weekend picks" },
    });
    fireEvent.change(screen.getByLabelText(/description|описание/i), {
      target: { value: "Best shots of the trip" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /create album|создать альбом/i }),
    );

    await waitFor(() => {
      expect(apiMocks.createAlbum).toHaveBeenCalledWith({
        name: "Weekend picks",
        description: "Best shots of the trip",
      });
    });
  });

  it("uploads multiple photos through the batch input", async () => {
    renderRoute();

    expect(
      await screen.findByRole("link", { name: "Open photo beach.jpg" }),
    ).toBeInTheDocument();

    const firstFile = new File(["first"], "first.jpg", { type: "image/jpeg" });
    const secondFile = new File(["second"], "second.png", {
      type: "image/png",
    });

    fireEvent.change(screen.getByLabelText(/upload photos|загрузить фото/i), {
      target: { files: [firstFile, secondFile] },
    });

    await waitFor(() => {
      expect(apiMocks.uploadPhoto).toHaveBeenNthCalledWith(1, firstFile);
      expect(apiMocks.uploadPhoto).toHaveBeenNthCalledWith(2, secondFile);
    });

    expect(
      await screen.findByText(/uploaded 2 photos|загружено 2 фото/i),
    ).toBeInTheDocument();
  });

  it("filters photos in the library view", async () => {
    apiMocks.listAllPhotos.mockResolvedValue([
      {
        id: "photo-1",
        uploaderId: "user-1",
        originalFilename: "beach.jpg",
        mimeType: "image/jpeg",
        width: 1920,
        height: 1080,
        sizeBytes: 512000,
        personalLibraryId: "library-1",
        exifData: null,
        takenAt: null,
        createdAt: "2026-04-02T10:05:00Z",
        variants: [],
      },
      {
        id: "photo-2",
        uploaderId: "user-1",
        originalFilename: "forest.png",
        mimeType: "image/png",
        width: 1600,
        height: 900,
        sizeBytes: 256000,
        personalLibraryId: "library-1",
        exifData: null,
        takenAt: null,
        createdAt: "2026-04-02T10:15:00Z",
        variants: [],
      },
    ]);

    renderRoute();

    expect(
      await screen.findByRole("link", { name: "forest.png" }),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByLabelText(/filter library|фильтр библиотеки/i),
      {
        target: { value: "beach" },
      },
    );

    expect(screen.getByText("beach.jpg")).toBeInTheDocument();
    expect(screen.queryByText("forest.png")).not.toBeInTheDocument();
  });

  it("keeps album photo actions scoped to the full library even when a filter is active", async () => {
    apiMocks.listAllPhotos.mockResolvedValue([
      {
        id: "photo-1",
        uploaderId: "user-1",
        originalFilename: "beach.jpg",
        mimeType: "image/jpeg",
        width: 1920,
        height: 1080,
        sizeBytes: 512000,
        personalLibraryId: "library-1",
        exifData: null,
        takenAt: null,
        createdAt: "2026-04-02T10:05:00Z",
        variants: [],
      },
      {
        id: "photo-2",
        uploaderId: "user-1",
        originalFilename: "forest.png",
        mimeType: "image/png",
        width: 1600,
        height: 900,
        sizeBytes: 256000,
        personalLibraryId: "library-1",
        exifData: null,
        takenAt: null,
        createdAt: "2026-04-02T10:15:00Z",
        variants: [],
      },
    ]);
    apiMocks.listAlbums.mockResolvedValue([
      {
        id: "album-1",
        name: "Weekend picks",
        description: "Trip highlights",
        ownerId: "user-1",
        personalLibraryId: "library-1",
        spaceId: null,
        createdAt: "2026-04-02T10:20:00Z",
        updatedAt: "2026-04-02T10:20:00Z",
        photos: [],
      },
    ]);

    renderRoute();

    expect(
      await screen.findByRole("link", { name: "forest.png" }),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByLabelText(/filter library|фильтр библиотеки/i),
      {
        target: { value: "weekend" },
      },
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: /albums|альбомы/i })[0]!,
    );

    const select = screen.getByLabelText("Photo for album Weekend picks");
    expect(
      screen.getByRole("option", { name: "beach.jpg" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "forest.png" }),
    ).toBeInTheDocument();
    expect(select).not.toBeDisabled();
  });
});
