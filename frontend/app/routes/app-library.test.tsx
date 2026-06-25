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
import { ThemeProvider } from "~/lib/theme";
import AppLibraryRoute, {
  clientAction as appLibraryClientAction,
  clientLoader as appLibraryClientLoader,
} from "~/routes/app-library";

const apiMocks = vi.hoisted(() => ({
  listAllPhotos: vi.fn(),
  listAlbums: vi.fn(),
  listGeoPhotos: vi.fn(),
  getPhotoBlob: vi.fn(),
  uploadPhoto: vi.fn(),
  deletePhoto: vi.fn(),
  createAlbum: vi.fn(),
  createAlbumShareLink: vi.fn(),
  createAlbumArchiveDownloadUrl: vi.fn(),
  addPhotoToAlbum: vi.fn(),
  updateAlbum: vi.fn(),
  deleteAlbum: vi.fn(),
  listAlbumShareLinks: vi.fn(),
  listFavorites: vi.fn(),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  revokeAlbumShareLink: vi.fn(),
}));

const clipboardWriteText = vi.fn();

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

// Deterministic Leaflet stub: jsdom lacks layout, so we fake the few map methods
// LibraryMap calls. project() maps lng/lat to pixels so proximity clustering is
// predictable; getBounds().contains() keeps every marker "in view".
vi.mock("leaflet", () => {
  const point = (x: number, y: number) => ({
    x,
    y,
    distanceTo: (other: { x: number; y: number }) =>
      Math.hypot(x - other.x, y - other.y),
  });
  const createMap = () => ({
    fitBounds: vi.fn(),
    setView: vi.fn(),
    flyTo: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    invalidateSize: vi.fn(),
    removeLayer: vi.fn(),
    remove: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    getZoom: () => 5,
    getBounds: () => ({
      getSouth: () => -85,
      getWest: () => -180,
      getNorth: () => 85,
      getEast: () => 180,
      contains: () => true,
    }),
    project: ([lat, lng]: [number, number]) => point(lng * 1000, lat * 1000),
    latLngToContainerPoint: ([lat, lng]: [number, number]) =>
      point(lng + 400, lat + 300),
  });
  return {
    default: {
      map: vi.fn(() => createMap()),
      tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
      latLngBounds: vi.fn(() => ({})),
    },
  };
});

describe("AppLibraryRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Force the legacy "card" tile style so existing tile assertions still
    // resolve. The redesigned default is "compact"; that variant is covered by
    // dedicated specs.
    window.localStorage.setItem(
      "pina-album-view-prefs",
      JSON.stringify({
        tileStyle: "card",
        columns: 4,
        heroStyle: "banner",
        photoColumns: 4,
      }),
    );
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    clipboardWriteText.mockReset();
    clipboardWriteText.mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: clipboardWriteText,
      },
    });
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
    apiMocks.createAlbumShareLink.mockResolvedValue({
      link: {
        id: "share-1",
        albumId: "album-1",
        createdById: "user-1",
        createdAt: "2026-04-05T12:00:00Z",
        expiresAt: null,
        revokedAt: null,
      },
      token: "plain-token-1",
    });
    apiMocks.createAlbumArchiveDownloadUrl.mockResolvedValue({
      url: "/api/v1/albums/album-1/download-by-token?token=signed-token",
      expiresAt: "2026-04-06T12:05:00Z",
    });
    apiMocks.addPhotoToAlbum.mockResolvedValue(undefined);
    apiMocks.updateAlbum.mockResolvedValue(undefined);
    apiMocks.deleteAlbum.mockResolvedValue(undefined);
    apiMocks.listAlbumShareLinks.mockResolvedValue([]);
    apiMocks.revokeAlbumShareLink.mockResolvedValue(undefined);
  });

  function renderRoute(initialEntry = "/app/library") {
    const Stub = createRoutesStub([
      {
        path: "/app/library",
        Component: AppLibraryRoute,
        action: async ({ request }) =>
          appLibraryClientAction({ request } as never),
        loader: async ({ request }) =>
          appLibraryClientLoader({ request } as never),
      },
      {
        path: "/app/library/albums/:albumId",
        Component: () => <div>Album detail target</div>,
      },
      {
        path: "/app/library/photos/:photoId",
        Component: () => <div>Photo detail target</div>,
      },
    ]);

    return render(
      <I18nProvider>
        <ThemeProvider>
          <Stub initialEntries={[initialEntry]} />
        </ThemeProvider>
      </I18nProvider>,
    );
  }

  function makeGeoPhoto(overrides: Record<string, unknown> = {}) {
    return {
      id: "geo-photo-1",
      uploaderId: "user-1",
      originalFilename: "geo.jpg",
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
      albums: [],
      ...overrides,
    };
  }

  function geoPage(items: unknown[]) {
    return {
      items,
      page: 0,
      size: 100,
      hasNext: false,
      totalItems: items.length,
      totalPages: 1,
    };
  }

  function makeAlbum(overrides: Record<string, unknown> = {}) {
    return {
      id: "album-1",
      name: "Summer Trip",
      description: "Sea, wind, and long evenings.",
      ownerId: "user-1",
      personalLibraryId: "library-1",
      spaceId: null,
      createdAt: "2026-04-03T10:00:00Z",
      updatedAt: "2026-04-05T14:30:00Z",
      coverPhotoId: "photo-1",
      coverVariants: [],
      photoCount: 3,
      mediaRangeStart: "2026-04-01T09:00:00Z",
      mediaRangeEnd: "2026-04-04T21:00:00Z",
      latestPhotoAddedAt: "2026-04-05T14:30:00Z",
      ...overrides,
    };
  }

  function createDeferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((innerResolve, innerReject) => {
      resolve = innerResolve;
      reject = innerReject;
    });
    return { promise, resolve, reject };
  }

  function makeUploadedPhoto(id: string, fileName: string) {
    return {
      id,
      uploaderId: "user-1",
      originalFilename: fileName,
      mimeType: "image/jpeg",
      width: 100,
      height: 100,
      sizeBytes: 100,
      personalLibraryId: "library-1",
      exifData: null,
      takenAt: null,
      latitude: null,
      longitude: null,
      createdAt: "2026-04-02T10:00:00Z",
      variants: [],
    };
  }

  it("adds a photo to favorites from the library grid", async () => {
    renderRoute();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Add beach.jpg to favorites",
      }),
    );

    await waitFor(() => {
      expect(apiMocks.addFavorite).toHaveBeenCalledWith("PHOTO", "photo-1");
    });
  });

  it("selects photos and bulk-favorites them", async () => {
    apiMocks.listAllPhotos.mockResolvedValue([
      {
        id: "photo-1",
        uploaderId: "user-1",
        originalFilename: "beach.jpg",
        mimeType: "image/jpeg",
        width: 1600,
        height: 1000,
        sizeBytes: 100,
        personalLibraryId: "library-1",
        exifData: null,
        takenAt: null,
        latitude: null,
        longitude: null,
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
        sizeBytes: 100,
        personalLibraryId: "library-1",
        exifData: null,
        takenAt: null,
        latitude: null,
        longitude: null,
        createdAt: "2026-04-01T20:15:00Z",
        variants: [],
      },
    ]);

    renderRoute();

    fireEvent.click(
      await screen.findByRole("button", { name: "Select beach.jpg" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Select dinner.jpg" }));

    expect(
      screen.getByRole("region", { name: /2 selected/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^favorite$/i }));

    await waitFor(() => {
      expect(apiMocks.addFavorite).toHaveBeenCalledWith("PHOTO", "photo-1");
      expect(apiMocks.addFavorite).toHaveBeenCalledWith("PHOTO", "photo-2");
    });
  });

  it("shows albums-only view when opened with view=albums", async () => {
    renderRoute("/app/library?view=albums");

    expect(
      (
        await screen.findAllByRole("button", {
          name: /create album|создать альбом/i,
        })
      )[0],
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^all$|^все$/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByText(/no personal albums yet|пока нет личных альбомов/i),
    ).toBeInTheDocument();
  });

  it("passes album sort from the URL into the loader and keeps it selected", async () => {
    apiMocks.listAlbums.mockResolvedValue([makeAlbum()]);

    renderRoute("/app/library?view=albums&sort=name&dir=asc");

    expect(await screen.findByText("Summer Trip")).toBeInTheDocument();
    expect(apiMocks.listAlbums).toHaveBeenLastCalledWith({
      sort: "name",
      direction: "asc",
    });
    expect(
      screen.getByLabelText(/sort albums|сортировка альбомов/i),
    ).toHaveValue("name:asc");
  });

  it("resets an invalid album sort to the default order and shows a hint", async () => {
    apiMocks.listAlbums.mockResolvedValue([makeAlbum()]);

    renderRoute("/app/library?view=albums&sort=bogus&dir=asc");

    expect(await screen.findByText("Summer Trip")).toBeInTheDocument();
    expect(apiMocks.listAlbums).toHaveBeenCalledWith({
      sort: "createdAt",
      direction: "desc",
    });
    expect(
      screen.getByText(
        /sort was reset to the default order|сброшена на порядок по умолчанию/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/sort albums|сортировка альбомов/i),
    ).toHaveValue("createdAt:desc");
  });

  it("opens the create album modal, closes on escape, and returns focus to the trigger", async () => {
    renderRoute("/app/library?view=albums");

    const trigger = (
      await screen.findAllByRole("button", {
        name: /create album|создать альбом/i,
      })
    )[0];
    fireEvent.click(trigger);

    expect(
      await screen.findByRole("heading", {
        name: /build a new personal album|соберите новый личный альбом/i,
      }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", {
          name: /build a new personal album|соберите новый личный альбом/i,
        }),
      ).not.toBeInTheDocument();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it("validates create album modal input before submitting", async () => {
    renderRoute("/app/library?view=albums");

    fireEvent.click(
      (
        await screen.findAllByRole("button", {
          name: /create album|создать альбом/i,
        })
      )[0],
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /create and open album|создать и открыть альбом/i,
      }),
    );

    expect(
      await screen.findByText(
        /album name is required|название альбома обязательно/i,
      ),
    ).toBeInTheDocument();
    expect(apiMocks.createAlbum).not.toHaveBeenCalled();
  });

  it("keeps create submit disabled during uploads and includes the uploaded photo after completion", async () => {
    const uploadDeferred = createDeferred<{
      id: string;
      uploaderId: string;
      originalFilename: string;
      mimeType: string;
      width: number;
      height: number;
      sizeBytes: number;
      personalLibraryId: string;
      exifData: null;
      takenAt: null;
      latitude: null;
      longitude: null;
      createdAt: string;
      variants: never[];
    }>();
    const createdAlbum = makeAlbum({
      id: "album-race",
      coverPhotoId: null,
      photoCount: 0,
      mediaRangeStart: null,
      mediaRangeEnd: null,
      latestPhotoAddedAt: null,
      previewPhotos: [],
    });
    apiMocks.uploadPhoto.mockReturnValue(uploadDeferred.promise);
    apiMocks.createAlbum.mockResolvedValue(createdAlbum);

    renderRoute("/app/library?view=albums");

    fireEvent.click(
      (
        await screen.findAllByRole("button", {
          name: /create album|создать альбом/i,
        })
      )[0],
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.change(
      within(dialog).getByRole("textbox", { name: /name|название/i }),
      {
        target: { value: "Race proof" },
      },
    );

    const file = new File(["png"], "forest.png", { type: "image/png" });
    fireEvent.change(
      within(dialog).getByLabelText(/choose files|выбрать файлы/i),
      {
        target: { files: [file] },
      },
    );

    expect(
      within(dialog).getByRole("button", {
        name: /uploading selected photos|загружаются выбранные фото/i,
      }),
    ).toBeDisabled();

    uploadDeferred.resolve({
      id: "photo-uploaded",
      uploaderId: "user-1",
      originalFilename: "forest.png",
      mimeType: "image/png",
      width: 1600,
      height: 900,
      sizeBytes: 256000,
      personalLibraryId: "library-1",
      exifData: null,
      takenAt: null,
      latitude: null,
      longitude: null,
      createdAt: "2026-04-02T11:00:00Z",
      variants: [],
    });

    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", {
          name: /create and open album|создать и открыть альбом/i,
        }),
      ).toBeEnabled();
    });

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: /create and open album|создать и открыть альбом/i,
      }),
    );

    await waitFor(() => {
      expect(apiMocks.addPhotoToAlbum).toHaveBeenCalledWith(
        "album-race",
        "photo-uploaded",
      );
    });
  });

  it("does not allow dismissing the create modal while album creation is still running", async () => {
    const createDeferredAlbum = createDeferred<ReturnType<typeof makeAlbum>>();
    apiMocks.createAlbum.mockReturnValue(createDeferredAlbum.promise);

    renderRoute("/app/library?view=albums");

    fireEvent.click(
      (
        await screen.findAllByRole("button", {
          name: /create album|создать альбом/i,
        })
      )[0],
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.change(
      within(dialog).getByRole("textbox", { name: /name|название/i }),
      {
        target: { value: "Long create" },
      },
    );
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: /create and open album|создать и открыть альбом/i,
      }),
    );

    expect(
      within(dialog).getAllByRole("button", { name: /cancel|отмена/i })[0],
    ).toBeDisabled();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.getByRole("heading", {
        name: /build a new personal album|соберите новый личный альбом/i,
      }),
    ).toBeInTheDocument();

    createDeferredAlbum.resolve(
      makeAlbum({
        id: "album-created",
        name: "Long create",
        coverPhotoId: null,
        photoCount: 0,
        mediaRangeStart: null,
        mediaRangeEnd: null,
        latestPhotoAddedAt: null,
        previewPhotos: [],
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("Album detail target")).toBeInTheDocument();
    });
  });

  it("creates an album from selected existing and uploaded photos, then navigates to detail", async () => {
    const createdAlbum = makeAlbum({
      id: "album-new",
      name: "Road notes",
      coverPhotoId: null,
      photoCount: 0,
      mediaRangeStart: null,
      mediaRangeEnd: null,
      latestPhotoAddedAt: null,
      previewPhotos: [],
    });
    apiMocks.createAlbum.mockResolvedValue(createdAlbum);
    apiMocks.uploadPhoto.mockResolvedValue({
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
      latitude: null,
      longitude: null,
      createdAt: "2026-04-02T11:00:00Z",
      variants: [],
    });

    renderRoute("/app/library?view=albums");

    fireEvent.click(
      (
        await screen.findAllByRole("button", {
          name: /create album|создать альбом/i,
        })
      )[0],
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.change(
      within(dialog).getByRole("textbox", { name: /name|название/i }),
      {
        target: { value: "Road notes" },
      },
    );

    fireEvent.click(
      within(dialog).getByRole("button", { name: /beach\.jpg/i }),
    );

    const file = new File(["png"], "forest.png", { type: "image/png" });
    fireEvent.change(
      within(dialog).getByLabelText(/choose files|выбрать файлы/i),
      {
        target: { files: [file] },
      },
    );

    await waitFor(() => {
      expect(apiMocks.uploadPhoto).toHaveBeenCalledTimes(1);
    });
    expect(
      await within(dialog).findByText(/2 selected|выбрано: 2/i),
    ).toBeInTheDocument();

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: /create and open album|создать и открыть альбом/i,
      }),
    );

    await waitFor(() => {
      expect(apiMocks.createAlbum).toHaveBeenCalledWith({
        name: "Road notes",
        description: "",
      });
    });
    await waitFor(() => {
      expect(apiMocks.addPhotoToAlbum).toHaveBeenCalledWith(
        "album-new",
        "photo-1",
      );
    });
    expect(await screen.findByText("Album detail target")).toBeInTheDocument();
  });

  it("renders album tiles and navigates into album detail from the tile body", async () => {
    apiMocks.listAlbums.mockResolvedValue([makeAlbum()]);
    renderRoute("/app/library?view=albums");

    expect(await screen.findByText("Summer Trip")).toBeInTheDocument();
    expect(
      screen.getByText(/sea, wind, and long evenings/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/3 photos|3 фото/i).length).toBeGreaterThan(0);

    fireEvent.click(
      screen.getByRole("link", {
        name: /open album summer trip|открыть альбом summer trip/i,
      }),
    );

    expect(await screen.findByText("Album detail target")).toBeInTheDocument();
  });

  it("opens the real share dialog from the album menu instead of copying an internal route", async () => {
    apiMocks.listAlbums.mockResolvedValue([makeAlbum()]);
    renderRoute("/app/library?view=albums");

    fireEvent.click(
      await screen.findByRole("button", {
        name: /open menu for summer trip|открыть меню для summer trip/i,
      }),
    );

    const menu = await screen.findByRole("menu", {
      name: /summer trip album actions|действия для альбома summer trip/i,
    });

    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent?.trim()),
    ).toEqual(["Favorite", "Edit", "Share", "Download", "Delete"]);

    fireEvent.click(within(menu).getByRole("menuitem", { name: "Share" }));

    await waitFor(() => {
      expect(apiMocks.listAlbumShareLinks).toHaveBeenCalledWith("album-1");
    });
    expect(
      screen.getByRole("heading", { name: /share "summer trip"/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Album detail target")).not.toBeInTheDocument();
  });

  it("edits and deletes albums through dialogs launched from the tile menu", async () => {
    apiMocks.listAlbums.mockResolvedValue([makeAlbum()]);
    renderRoute("/app/library?view=albums");

    fireEvent.click(
      await screen.findByRole("button", {
        name: /open menu for summer trip|открыть меню для summer trip/i,
      }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));

    const editDialog = await screen.findByRole("heading", {
      name: /update album details/i,
    });
    const editOverlay = screen.getByRole("dialog");
    expect(editDialog).toBeInTheDocument();

    fireEvent.change(
      within(editOverlay!).getByRole("textbox", { name: /name|название/i }),
      {
        target: { value: "Summer 2026" },
      },
    );
    fireEvent.change(
      within(editOverlay!).getByRole("textbox", {
        name: /description|описание/i,
      }),
      {
        target: { value: "Updated album copy." },
      },
    );
    fireEvent.click(
      within(editOverlay!).getByRole("button", {
        name: /save album|сохранить альбом/i,
      }),
    );

    await waitFor(() => {
      expect(apiMocks.updateAlbum).toHaveBeenCalledWith("album-1", {
        name: "Summer 2026",
        description: "Updated album copy.",
      });
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: /open menu for summer trip|открыть меню для summer trip/i,
      }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    const deleteDialog = await screen.findByRole("heading", {
      name: /delete "summer trip"\?/i,
    });
    const deleteOverlay = screen.getByRole("dialog");
    expect(deleteDialog).toBeInTheDocument();
    fireEvent.click(
      within(deleteOverlay!).getByRole("button", {
        name: /delete album|удалить альбом/i,
      }),
    );

    await waitFor(() => {
      expect(apiMocks.deleteAlbum).toHaveBeenCalledWith("album-1");
    });
  });

  it("shows empty-state messaging when albums do not match the current filter", async () => {
    apiMocks.listAlbums.mockResolvedValue([
      makeAlbum({ id: "album-1", name: "Summer Trip" }),
    ]);
    renderRoute("/app/library?view=albums");

    fireEvent.change(
      await screen.findByLabelText(/search albums|поиск альбомов/i),
      {
        target: { value: "winter" },
      },
    );

    expect(
      await screen.findByText(
        /no albums match the current filter|нет альбомов, подходящих под текущий фильтр/i,
      ),
    ).toBeInTheDocument();
  });

  it("groups photos by day in the photos view", async () => {
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

    expect(
      await screen.findByRole("link", { name: "Open photo beach.jpg" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open photo dinner.jpg" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: /photos|фото/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /April 2, 2026/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /April 1, 2026/i }),
    ).toBeInTheDocument();
  });

  it("loads geo markers for the URL viewport and opens photo detail", async () => {
    apiMocks.listAllPhotos.mockResolvedValue([
      makeGeoPhoto({ id: "photo-map-1", originalFilename: "belgrade.jpg" }),
    ]);
    apiMocks.listGeoPhotos.mockResolvedValue(
      geoPage([
        makeGeoPhoto({ id: "photo-map-1", originalFilename: "belgrade.jpg" }),
      ]),
    );

    renderRoute("/app/library?view=map&swLat=44&swLng=20&neLat=45&neLng=21");

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

    const openButton = await screen.findByRole("button", {
      name: /open photo detail/i,
    });
    fireEvent.click(openButton);

    expect(await screen.findByText("Photo detail target")).toBeInTheDocument();
  });

  it("filters map markers by favorites", async () => {
    const belgrade = makeGeoPhoto({
      id: "photo-map-1",
      originalFilename: "belgrade.jpg",
      latitude: 44.8,
      longitude: 20.46,
    });
    const sydney = makeGeoPhoto({
      id: "photo-map-2",
      originalFilename: "sydney.jpg",
      latitude: -33.87,
      longitude: 151.2,
    });
    apiMocks.listAllPhotos.mockResolvedValue([belgrade, sydney]);
    apiMocks.listGeoPhotos.mockResolvedValue(geoPage([belgrade, sydney]));
    apiMocks.listFavorites.mockImplementation(async (targetType?: string) => {
      if (targetType === "PHOTO") {
        return [
          {
            id: "fav-1",
            userId: "user-1",
            targetType: "PHOTO",
            targetId: "photo-map-1",
            createdAt: "2026-04-03T09:15:00Z",
          },
        ];
      }
      return [];
    });

    renderRoute("/app/library?view=map");

    expect(
      await screen.findByRole("button", {
        name: "Open map marker for belgrade.jpg",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Open map marker for sydney.jpg",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /favorites|избранное/i }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("button", {
          name: "Open map marker for sydney.jpg",
        }),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", {
        name: "Open map marker for belgrade.jpg",
      }),
    ).toBeInTheDocument();
  });

  it("shows the map error state with a retry action", async () => {
    apiMocks.listAllPhotos.mockResolvedValue([
      makeGeoPhoto({ id: "photo-map-1", originalFilename: "belgrade.jpg" }),
    ]);
    apiMocks.listGeoPhotos.mockRejectedValue(new Error("Geo endpoint failed"));

    renderRoute("/app/library?view=map");

    expect(await screen.findByText("Geo endpoint failed")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /retry|повторить/i }),
    ).toBeInTheDocument();
  });

  it("shows the no-GPS empty state when no photos have coordinates", async () => {
    // The default listAllPhotos fixture has a photo without latitude/longitude.
    renderRoute("/app/library?view=map");

    expect(
      await screen.findByRole("heading", {
        name: /no geo-tagged photos yet|пока нет фото с геотегами/i,
      }),
    ).toBeInTheDocument();
  });

  it("dispatches uploads in parallel up to the concurrency limit and reports partial failures", async () => {
    const files = Array.from(
      { length: 5 },
      (_, i) => new File(["x"], `photo-${i}.jpg`, { type: "image/jpeg" }),
    );
    const deferreds = files.map(() =>
      createDeferred<{
        id: string;
        uploaderId: string;
        originalFilename: string;
        mimeType: string;
        width: number;
        height: number;
        sizeBytes: number;
        personalLibraryId: string;
        exifData: null;
        takenAt: null;
        latitude: null;
        longitude: null;
        createdAt: string;
        variants: never[];
      }>(),
    );
    apiMocks.uploadPhoto.mockImplementation((file: File) => {
      const index = files.indexOf(file);
      return deferreds[index]!.promise;
    });

    renderRoute();

    expect(
      await screen.findByRole("link", { name: "Open photo beach.jpg" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/upload photos|загрузить фото/i), {
      target: { files },
    });

    // The pool should have dispatched exactly the concurrency limit before
    // any individual upload settles.
    await waitFor(() => {
      expect(apiMocks.uploadPhoto).toHaveBeenCalledTimes(3);
    });
    // No further uploads dispatch while the first three are still in flight.
    await Promise.resolve();
    await Promise.resolve();
    expect(apiMocks.uploadPhoto).toHaveBeenCalledTimes(3);

    // Resolve the first upload — the next queued file should start.
    deferreds[0]!.resolve({
      id: "photo-0",
      uploaderId: "user-1",
      originalFilename: "photo-0.jpg",
      mimeType: "image/jpeg",
      width: 100,
      height: 100,
      sizeBytes: 100,
      personalLibraryId: "library-1",
      exifData: null,
      takenAt: null,
      latitude: null,
      longitude: null,
      createdAt: "2026-04-02T10:00:00Z",
      variants: [],
    });
    await waitFor(() => {
      expect(apiMocks.uploadPhoto).toHaveBeenCalledTimes(4);
    });

    // Fail one of the in-flight uploads; the batch must continue.
    deferreds[1]!.reject(new Error("network down"));
    await waitFor(() => {
      expect(apiMocks.uploadPhoto).toHaveBeenCalledTimes(5);
    });

    // Resolve the rest.
    for (let i = 2; i < deferreds.length; i += 1) {
      deferreds[i]!.resolve({
        id: `photo-${i}`,
        uploaderId: "user-1",
        originalFilename: `photo-${i}.jpg`,
        mimeType: "image/jpeg",
        width: 100,
        height: 100,
        sizeBytes: 100,
        personalLibraryId: "library-1",
        exifData: null,
        takenAt: null,
        latitude: null,
        longitude: null,
        createdAt: "2026-04-02T10:00:00Z",
        variants: [],
      });
    }

    expect(
      await screen.findByText(/uploaded 4 of 5 photos|загружено 4 из 5 фото/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /photo-1\.jpg: (photo upload failed|ошибка загрузки фото|network down)/i,
      ),
    ).toBeInTheDocument();
  });

  it("ignores a library drop upload while another batch is active", async () => {
    const files = Array.from(
      { length: 5 },
      (_, i) => new File(["x"], `active-${i}.jpg`, { type: "image/jpeg" }),
    );
    const deferreds = files.map(() =>
      createDeferred<ReturnType<typeof makeUploadedPhoto>>(),
    );
    const ignoredFile = new File(["ignored"], "ignored.jpg", {
      type: "image/jpeg",
    });
    apiMocks.uploadPhoto.mockImplementation((file: File) => {
      const index = files.indexOf(file);
      if (index === -1) {
        throw new Error(`unexpected upload: ${file.name}`);
      }
      return deferreds[index]!.promise;
    });

    renderRoute();

    expect(
      await screen.findByRole("link", { name: "Open photo beach.jpg" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/upload photos|загрузить фото/i), {
      target: { files },
    });

    await waitFor(() => {
      expect(apiMocks.uploadPhoto).toHaveBeenCalledTimes(3);
    });

    fireEvent.drop(screen.getByText("active-2.jpg"), {
      dataTransfer: {
        files: [ignoredFile],
      },
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(apiMocks.uploadPhoto).toHaveBeenCalledTimes(3);
    expect(
      apiMocks.uploadPhoto.mock.calls.some(([file]) => file === ignoredFile),
    ).toBe(false);

    for (const [index, deferred] of deferreds.entries()) {
      deferred.resolve(
        makeUploadedPhoto(`active-${index}`, files[index]!.name),
      );
    }

    expect(
      await screen.findByText(/uploaded 5 photos|загружено 5 фото/i),
    ).toBeInTheDocument();
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

  it("filters photos by media type in the photos view", async () => {
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
        originalFilename: "forest.mp4",
        mimeType: "video/mp4",
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
      await screen.findByRole("link", { name: "Open photo beach.jpg" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open photo forest.mp4" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^videos$|^видео$/i }));

    expect(
      screen.getByRole("link", { name: "Open photo forest.mp4" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Open photo beach.jpg" }),
    ).not.toBeInTheDocument();
  });

  it("renders empty album tiles with placeholder copy instead of inline photo controls", async () => {
    apiMocks.listAlbums.mockResolvedValue([
      makeAlbum({
        id: "album-1",
        name: "Weekend picks",
        description: "Trip highlights",
        coverPhotoId: null,
        photoCount: 0,
        mediaRangeStart: null,
        mediaRangeEnd: null,
        latestPhotoAddedAt: null,
        previewPhotos: [],
      }),
    ]);

    renderRoute("/app/library?view=albums");

    expect(await screen.findByText("Weekend picks")).toBeInTheDocument();
    expect(
      screen.getByText(
        /no photos yet\. add the first image from the album detail route/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/0 photos/i).length).toBeGreaterThan(0);
    expect(
      screen.queryByLabelText(/photo for album weekend picks/i),
    ).not.toBeInTheDocument();
  });
});
