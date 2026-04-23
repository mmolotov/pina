import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  listGeoPhotos: vi.fn(),
  getPhotoBlob: vi.fn(),
  uploadPhoto: vi.fn(),
  deletePhoto: vi.fn(),
  createAlbum: vi.fn(),
  createAlbumShareLink: vi.fn(),
  downloadAlbumArchive: vi.fn(),
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

describe("AppLibraryRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    apiMocks.downloadAlbumArchive.mockResolvedValue({
      blob: new Blob(["zip"], { type: "application/zip" }),
      filename: "summer-trip.zip",
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
    ]);

    return render(
      <I18nProvider>
        <Stub initialEntries={[initialEntry]} />
      </I18nProvider>,
    );
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
        screen.getByRole("button", {
          name: /create album|создать альбом/i,
        }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /spaces/i })).toBeInTheDocument();
    expect(screen.getByText(/no personal albums yet|пока нет личных альбомов/i)).toBeInTheDocument();
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
      screen.getByText(/sort was reset to the default order|сброшена на порядок по умолчанию/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/sort albums|сортировка альбомов/i),
    ).toHaveValue("createdAt:desc");
  });

  it("opens the create album modal, closes on escape, and returns focus to the trigger", async () => {
    renderRoute();

    fireEvent.click(
      await screen.findByRole("button", { name: /albums|альбомы/i }),
    );

    const trigger = screen.getByRole("button", {
      name: /create album|создать альбом/i,
    });
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
    renderRoute();

    fireEvent.click(
      await screen.findByRole("button", { name: /albums|альбомы/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /create album|создать альбом/i }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /create and open album|создать и открыть альбом/i,
      }),
    );

    expect(
      await screen.findByText(/album name is required|название альбома обязательно/i),
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
    });
    apiMocks.uploadPhoto.mockReturnValue(uploadDeferred.promise);
    apiMocks.createAlbum.mockResolvedValue(createdAlbum);

    renderRoute("/app/library?view=albums");

    fireEvent.click(
      await screen.findByRole("button", { name: /create album|создать альбом/i }),
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: /name|название/i }), {
      target: { value: "Race proof" },
    });

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
      await screen.findByRole("button", { name: /create album|создать альбом/i }),
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: /name|название/i }), {
      target: { value: "Long create" },
    });
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

    renderRoute();

    fireEvent.click(
      await screen.findByRole("button", { name: /albums|альбомы/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /create album|создать альбом/i }),
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: /name|название/i }), {
      target: { value: "Road notes" },
    });

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
      expect(apiMocks.addPhotoToAlbum).toHaveBeenCalledWith("album-new", "photo-1");
    });
    expect(await screen.findByText("Album detail target")).toBeInTheDocument();
  });

  it("renders album tiles and navigates into album detail from the tile body", async () => {
    apiMocks.listAlbums.mockResolvedValue([makeAlbum()]);
    renderRoute();

    fireEvent.click(
      await screen.findByRole("button", { name: /albums|альбомы/i }),
    );

    expect(await screen.findByText("Summer Trip")).toBeInTheDocument();
    expect(screen.getByText(/sea, wind, and long evenings/i)).toBeInTheDocument();
    expect(screen.getByText(/3 photos|3 фото/i)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("link", { name: /open album summer trip|открыть альбом summer trip/i }),
    );

    expect(await screen.findByText("Album detail target")).toBeInTheDocument();
  });

  it("opens the real share dialog from the album menu instead of copying an internal route", async () => {
    apiMocks.listAlbums.mockResolvedValue([makeAlbum()]);
    renderRoute();

    fireEvent.click(
      await screen.findByRole("button", { name: /albums|альбомы/i }),
    );

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
        .getAllByRole("button")
        .map((button) => button.textContent?.trim()),
    ).toEqual(["Favorite", "Edit", "Share", "Download", "Delete"]);

    fireEvent.click(within(menu).getByRole("button", { name: "Share" }));

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
    renderRoute();

    fireEvent.click(
      await screen.findByRole("button", { name: /albums|альбомы/i }),
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: /open menu for summer trip|открыть меню для summer trip/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const editDialog = await screen.findByRole("heading", {
      name: /update album details/i,
    });
    const editOverlay = screen.getByRole("dialog");
    expect(editDialog).toBeInTheDocument();

    fireEvent.change(within(editOverlay!).getByRole("textbox", { name: /name|название/i }), {
      target: { value: "Summer 2026" },
    });
    fireEvent.change(
      within(editOverlay!).getByRole("textbox", { name: /description|описание/i }),
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
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

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
    renderRoute();

    fireEvent.click(
      await screen.findByRole("button", { name: /albums|альбомы/i }),
    );

    fireEvent.change(
      screen.getByLabelText(/filter library|фильтр библиотеки/i),
      {
        target: { value: "winter" },
      },
    );

    expect(
      await screen.findByText(/no albums match the current filter|нет альбомов, подходящих под текущий фильтр/i),
    ).toBeInTheDocument();
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
      expect(apiMocks.listGeoPhotos).toHaveBeenCalledTimes(2);
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
      }),
    ]);

    renderRoute();

    fireEvent.click(
      await screen.findByRole("button", { name: /albums|альбомы/i }),
    );

    expect(await screen.findByText("Weekend picks")).toBeInTheDocument();
    expect(
      screen.getByText(/no photos yet\. add the first image from the album detail route/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/0 photos/i)).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/photo for album weekend picks/i),
    ).not.toBeInTheDocument();
  });
});
