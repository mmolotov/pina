import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppLibraryRoute, {
  clientAction as appLibraryClientAction,
  clientLoader as appLibraryClientLoader,
} from "~/routes/app-library";

const apiMocks = vi.hoisted(() => ({
  listAllPhotos: vi.fn(),
  listAlbums: vi.fn(),
  listAllAlbumPhotos: vi.fn(),
  listGeoPhotos: vi.fn(),
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

  it("adds a photo to favorites from the library grid", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/library",
        Component: AppLibraryRoute,
        action: async ({ request }) =>
          appLibraryClientAction({ request } as never),
        loader: async () => appLibraryClientLoader(),
      },
    ]);

    render(<Stub initialEntries={["/app/library"]} />);

    expect(await screen.findByText("beach.jpg")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Add beach.jpg to favorites" }),
    );

    await waitFor(() => {
      expect(apiMocks.addFavorite).toHaveBeenCalledWith("PHOTO", "photo-1");
    });
  });

  it("switches to albums-only view", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/library",
        Component: AppLibraryRoute,
        action: async ({ request }) =>
          appLibraryClientAction({ request } as never),
        loader: async () => appLibraryClientLoader(),
      },
    ]);

    render(<Stub initialEntries={["/app/library"]} />);

    expect(await screen.findByText("Current uploads")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Albums only" }));

    await waitFor(() => {
      expect(screen.queryByText("Current uploads")).not.toBeInTheDocument();
    });
    expect(screen.getByText("New collection")).toBeInTheDocument();
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

    const Stub = createRoutesStub([
      {
        path: "/app/library",
        Component: AppLibraryRoute,
        action: async ({ request }) =>
          appLibraryClientAction({ request } as never),
        loader: async () => appLibraryClientLoader(),
      },
    ]);

    render(<Stub initialEntries={["/app/library"]} />);

    expect(await screen.findByText("beach.jpg")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Timeline" }));

    await waitFor(() => {
      expect(screen.getByText("Photo timeline")).toBeInTheDocument();
    });
    expect(screen.getByText("2026-04-02")).toBeInTheDocument();
    expect(screen.getByText("2026-04-01")).toBeInTheDocument();
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

    const Stub = createRoutesStub([
      {
        path: "/app/library",
        Component: AppLibraryRoute,
        action: async ({ request }) =>
          appLibraryClientAction({ request } as never),
        loader: async () => appLibraryClientLoader(),
      },
    ]);

    render(
      <Stub
        initialEntries={[
          "/app/library?view=map&swLat=44&swLng=20&neLat=45&neLng=21",
        ]}
      />,
    );

    expect(await screen.findByText("Geo map")).toBeInTheDocument();

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

    expect(screen.getByText("Photo selected")).toBeInTheDocument();
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

    const Stub = createRoutesStub([
      {
        path: "/app/library",
        Component: AppLibraryRoute,
        action: async ({ request }) =>
          appLibraryClientAction({ request } as never),
        loader: async () => appLibraryClientLoader(),
      },
    ]);

    render(
      <Stub
        initialEntries={[
          "/app/library?view=map&swLat=44&swLng=20&neLat=45&neLng=21",
        ]}
      />,
    );

    expect(await screen.findByText("Geo map")).toBeInTheDocument();

    const clusterButton = await screen.findByRole("button", {
      name: "Open map cluster with 2 photos",
    });
    fireEvent.click(clusterButton);

    expect(await screen.findByText("Cluster of 2 photos")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Zoom into cluster" }));

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

    const Stub = createRoutesStub([
      {
        path: "/app/library",
        Component: AppLibraryRoute,
        action: async ({ request }) =>
          appLibraryClientAction({ request } as never),
        loader: async () => appLibraryClientLoader(),
      },
    ]);

    render(
      <Stub
        initialEntries={[
          "/app/library?view=map&swLat=10&swLng=20&neLat=30&neLng=40",
        ]}
      />,
    );

    expect(await screen.findByText("Geo map")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pan east" }));

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

    const Stub = createRoutesStub([
      {
        path: "/app/library",
        Component: AppLibraryRoute,
        action: async ({ request }) =>
          appLibraryClientAction({ request } as never),
        loader: async () => appLibraryClientLoader(),
      },
    ]);

    render(<Stub initialEntries={["/app/library?view=map"]} />);

    expect(await screen.findByText("Geo map")).toBeInTheDocument();
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

    const Stub = createRoutesStub([
      {
        path: "/app/library",
        Component: AppLibraryRoute,
        action: async ({ request }) =>
          appLibraryClientAction({ request } as never),
        loader: async () => appLibraryClientLoader(),
      },
    ]);

    render(<Stub initialEntries={["/app/library?view=map"]} />);

    expect(await screen.findByText("Geo map")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", {
        name: "Open map marker for belgrade.jpg",
      }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter library"), {
      target: { value: "forest" },
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("button", {
          name: "Open map marker for belgrade.jpg",
        }),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Open map marker for forest.png" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter library"), {
      target: { value: "desert" },
    });

    expect(
      await screen.findByText("No geo-tagged photos match the current filter"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Clear filter" }).length,
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

    const Stub = createRoutesStub([
      {
        path: "/app/library",
        Component: AppLibraryRoute,
        action: async ({ request }) =>
          appLibraryClientAction({ request } as never),
        loader: async () => appLibraryClientLoader(),
      },
    ]);

    render(<Stub initialEntries={["/app/library?view=map"]} />);

    expect(await screen.findByText("Geo map")).toBeInTheDocument();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Open map marker for belgrade.jpg",
      }),
    );

    expect(await screen.findByText("Photo selected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));

    await waitFor(() => {
      expect(screen.getByText("Nothing selected")).toBeInTheDocument();
    });
  });

  it("creates a new album through the route action", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/library",
        Component: AppLibraryRoute,
        action: async ({ request }) =>
          appLibraryClientAction({ request } as never),
        loader: async () => appLibraryClientLoader(),
      },
    ]);

    render(<Stub initialEntries={["/app/library"]} />);

    expect(await screen.findByText("beach.jpg")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Albums only" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Weekend picks" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Best shots of the trip" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create album" }));

    await waitFor(() => {
      expect(apiMocks.createAlbum).toHaveBeenCalledWith({
        name: "Weekend picks",
        description: "Best shots of the trip",
      });
    });
  });

  it("uploads multiple photos through the batch input", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/library",
        Component: AppLibraryRoute,
        action: async ({ request }) =>
          appLibraryClientAction({ request } as never),
        loader: async () => appLibraryClientLoader(),
      },
    ]);

    render(<Stub initialEntries={["/app/library"]} />);

    expect(await screen.findByText("beach.jpg")).toBeInTheDocument();

    const firstFile = new File(["first"], "first.jpg", { type: "image/jpeg" });
    const secondFile = new File(["second"], "second.png", {
      type: "image/png",
    });

    fireEvent.change(screen.getByLabelText("Upload photos"), {
      target: { files: [firstFile, secondFile] },
    });

    await waitFor(() => {
      expect(apiMocks.uploadPhoto).toHaveBeenNthCalledWith(1, firstFile);
      expect(apiMocks.uploadPhoto).toHaveBeenNthCalledWith(2, secondFile);
    });

    expect(await screen.findByText("Uploaded 2 photos.")).toBeInTheDocument();
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

    const Stub = createRoutesStub([
      {
        path: "/app/library",
        Component: AppLibraryRoute,
        action: async ({ request }) =>
          appLibraryClientAction({ request } as never),
        loader: async () => appLibraryClientLoader(),
      },
    ]);

    render(<Stub initialEntries={["/app/library"]} />);

    expect(
      await screen.findByRole("link", { name: "forest.png" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter library"), {
      target: { value: "beach" },
    });

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

    const Stub = createRoutesStub([
      {
        path: "/app/library",
        Component: AppLibraryRoute,
        action: async ({ request }) =>
          appLibraryClientAction({ request } as never),
        loader: async () => appLibraryClientLoader(),
      },
    ]);

    render(<Stub initialEntries={["/app/library"]} />);

    expect(
      await screen.findByRole("link", { name: "forest.png" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter library"), {
      target: { value: "weekend" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Albums only" }));

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
