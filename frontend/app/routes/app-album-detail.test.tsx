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
  getAlbum: vi.fn(),
  listAllAlbumPhotos: vi.fn(),
  listPhotos: vi.fn(),
  listFavorites: vi.fn(),
  getPhotoBlob: vi.fn(),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  updateAlbum: vi.fn(),
  deleteAlbum: vi.fn(),
  addPhotoToAlbum: vi.fn(),
  clearAlbumCover: vi.fn(),
  createAlbumShareLink: vi.fn(),
  createAlbumArchiveDownloadUrl: vi.fn(),
  listAlbumShareLinks: vi.fn(),
  removePhotoFromAlbum: vi.fn(),
  revokeAlbumShareLink: vi.fn(),
  setAlbumCover: vi.fn(),
  uploadPhoto: vi.fn(),
}));

const clipboardWriteText = vi.fn();

vi.mock("~/lib/api", () => ({
  ...apiMocks,
}));

describe("AppAlbumDetailRoute", () => {
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
    apiMocks.getAlbum.mockResolvedValue({
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
      previewPhotos: [],
    });
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
    apiMocks.listPhotos.mockResolvedValue({
      items: [
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
      ],
      page: 0,
      size: 100,
      hasNext: false,
      totalItems: 2,
      totalPages: 1,
    });
    apiMocks.listFavorites.mockResolvedValue([]);
    apiMocks.getPhotoBlob.mockResolvedValue(
      new Blob(["thumb"], { type: "image/jpeg" }),
    );
    apiMocks.addFavorite.mockResolvedValue(undefined);
    apiMocks.removeFavorite.mockResolvedValue(undefined);
    apiMocks.updateAlbum.mockResolvedValue(undefined);
    apiMocks.deleteAlbum.mockResolvedValue(undefined);
    apiMocks.addPhotoToAlbum.mockResolvedValue(undefined);
    apiMocks.clearAlbumCover.mockResolvedValue({
      id: "album-1",
      name: "Summer Week",
      description: "Pier, market, and long golden evenings",
      ownerId: "user-1",
      personalLibraryId: "library-1",
      spaceId: null,
      createdAt: "2026-04-01T10:00:00Z",
      updatedAt: "2026-04-05T18:30:00Z",
      coverPhotoId: null,
      coverVariants: [],
      photoCount: 2,
      mediaRangeStart: "2026-04-01T09:00:00Z",
      mediaRangeEnd: "2026-04-02T20:15:00Z",
      latestPhotoAddedAt: "2026-04-05T18:30:00Z",
      previewPhotos: [],
    });
    apiMocks.createAlbumShareLink.mockResolvedValue({
      link: {
        id: "share-1",
        albumId: "album-1",
        createdById: "user-1",
        createdAt: "2026-04-06T08:00:00Z",
        expiresAt: null,
        revokedAt: null,
      },
      token: "plain-token-1",
    });
    apiMocks.createAlbumArchiveDownloadUrl.mockResolvedValue({
      url: "/api/v1/albums/album-1/download-by-token?token=signed-token",
      expiresAt: "2026-04-06T12:05:00Z",
    });
    apiMocks.listAlbumShareLinks.mockResolvedValue([]);
    apiMocks.removePhotoFromAlbum.mockResolvedValue(undefined);
    apiMocks.revokeAlbumShareLink.mockResolvedValue(undefined);
    apiMocks.setAlbumCover.mockResolvedValue({
      id: "album-1",
      name: "Summer Week",
      description: "Pier, market, and long golden evenings",
      ownerId: "user-1",
      personalLibraryId: "library-1",
      spaceId: null,
      createdAt: "2026-04-01T10:00:00Z",
      updatedAt: "2026-04-05T18:30:00Z",
      coverPhotoId: "photo-2",
      coverVariants: [],
      photoCount: 2,
      mediaRangeStart: "2026-04-01T09:00:00Z",
      mediaRangeEnd: "2026-04-02T20:15:00Z",
      latestPhotoAddedAt: "2026-04-05T18:30:00Z",
      previewPhotos: [],
    });
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
      createdAt: "2026-04-02T20:00:00Z",
      variants: [],
    };
  }

  it("renders album detail and navigates into the album photo route", async () => {
    renderRoute();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Summer Week" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Pier, market, and long golden evenings"),
    ).toBeInTheDocument();
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
    expect(apiMocks.getAlbum).toHaveBeenCalledWith("album-1");
    expect(apiMocks.listPhotos).toHaveBeenCalledWith(0, 100);
  });

  it("renders the empty album state", async () => {
    apiMocks.listAllAlbumPhotos.mockResolvedValue([]);
    apiMocks.getAlbum.mockResolvedValue({
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
      previewPhotos: [],
    });

    renderRoute();

    expect(
      await screen.findByText(
        /no photos in this album yet|в этом альбоме пока нет фото/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /add photos|добавить фото/i })[0],
    ).toBeInTheDocument();
  });

  it("shows that the existing-photo picker is bounded to the first page", async () => {
    apiMocks.listPhotos.mockResolvedValue({
      items: [
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
      ],
      page: 0,
      size: 100,
      hasNext: true,
      totalItems: 300,
      totalPages: 3,
    });

    renderRoute();

    fireEvent.click(
      await screen.findByRole("button", { name: /add photos|добавить фото/i }),
    );

    expect(
      await screen.findByText(
        "For performance this picker currently loads only the first 100 personal photos.",
      ),
    ).toBeInTheDocument();
  });

  it("sets an explicit album cover and can restore automatic cover selection", async () => {
    renderRoute();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Summer Week" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /set as cover/i }));

    await waitFor(() => {
      expect(apiMocks.setAlbumCover).toHaveBeenCalledWith("album-1", "photo-2");
    });

    fireEvent.click(screen.getByRole("button", { name: /edit album/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: /use automatic cover/i }),
    );

    await waitFor(() => {
      expect(apiMocks.clearAlbumCover).toHaveBeenCalledWith("album-1");
    });
  });

  it("downloads the album archive from the detail toolbar", async () => {
    renderRoute();

    fireEvent.click(
      await screen.findByRole("button", { name: /download|скачать/i }),
    );

    await waitFor(() => {
      expect(apiMocks.createAlbumArchiveDownloadUrl).toHaveBeenCalledWith(
        "album-1",
        "ORIGINAL",
      );
    });
  });

  it("creates and revokes public share links from the share dialog", async () => {
    apiMocks.listAlbumShareLinks.mockResolvedValueOnce([
      {
        id: "share-old",
        albumId: "album-1",
        createdById: "user-1",
        createdAt: "2026-04-05T12:00:00Z",
        expiresAt: null,
        revokedAt: null,
      },
    ]);
    apiMocks.listAlbumShareLinks.mockResolvedValueOnce([
      {
        id: "share-old",
        albumId: "album-1",
        createdById: "user-1",
        createdAt: "2026-04-05T12:00:00Z",
        expiresAt: null,
        revokedAt: "2026-04-06T10:00:00Z",
      },
    ]);

    renderRoute();

    fireEvent.click(
      await screen.findByRole("button", { name: /share|поделиться/i }),
    );

    expect(
      await screen.findByRole("heading", { name: /share "summer week"/i }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /create public link/i }),
    );

    await waitFor(() => {
      expect(apiMocks.createAlbumShareLink).toHaveBeenCalledWith("album-1");
    });

    fireEvent.click(screen.getByRole("button", { name: /copy token/i }));

    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith("plain-token-1");
    });

    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));

    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        expect.stringContaining("/s/album/plain-token-1"),
      );
    });

    fireEvent.click(screen.getAllByRole("button", { name: /revoke/i })[1]!);

    await waitFor(() => {
      expect(apiMocks.revokeAlbumShareLink).toHaveBeenCalledWith(
        "album-1",
        "share-old",
      );
    });
  });

  it("uploads photos to an album in parallel up to the concurrency limit and reports partial failures", async () => {
    const files = Array.from(
      { length: 5 },
      (_, i) => new File(["x"], `dropped-${i}.jpg`, { type: "image/jpeg" }),
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

    fireEvent.click(
      await screen.findByRole("button", { name: /add photos|добавить фото/i }),
    );

    const input = await screen.findByLabelText(
      /jpeg or png files|файлы jpeg или png/i,
    );
    fireEvent.change(input, { target: { files } });

    await waitFor(() => {
      expect(apiMocks.uploadPhoto).toHaveBeenCalledTimes(3);
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(apiMocks.uploadPhoto).toHaveBeenCalledTimes(3);

    deferreds[0]!.resolve({
      id: "uploaded-0",
      uploaderId: "user-1",
      originalFilename: "dropped-0.jpg",
      mimeType: "image/jpeg",
      width: 100,
      height: 100,
      sizeBytes: 100,
      personalLibraryId: "library-1",
      exifData: null,
      takenAt: null,
      latitude: null,
      longitude: null,
      createdAt: "2026-04-02T20:00:00Z",
      variants: [],
    });
    await waitFor(() => {
      expect(apiMocks.uploadPhoto).toHaveBeenCalledTimes(4);
    });

    deferreds[1]!.reject(new Error("network down"));
    await waitFor(() => {
      expect(apiMocks.uploadPhoto).toHaveBeenCalledTimes(5);
    });

    for (let i = 2; i < deferreds.length; i += 1) {
      deferreds[i]!.resolve({
        id: `uploaded-${i}`,
        uploaderId: "user-1",
        originalFilename: `dropped-${i}.jpg`,
        mimeType: "image/jpeg",
        width: 100,
        height: 100,
        sizeBytes: 100,
        personalLibraryId: "library-1",
        exifData: null,
        takenAt: null,
        latitude: null,
        longitude: null,
        createdAt: "2026-04-02T20:00:00Z",
        variants: [],
      });
    }

    await waitFor(() => {
      expect(apiMocks.addPhotoToAlbum).toHaveBeenCalledTimes(4);
    });
    expect(
      await screen.findByText(
        /added 4 of 5 uploaded photos|добавлено 4 из 5 загруженных фото/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /dropped-1\.jpg: (photo upload failed|ошибка загрузки фото|network down)/i,
      ),
    ).toBeInTheDocument();
  });

  it("ignores a second album upload selection while the current batch is active", async () => {
    const files = Array.from(
      { length: 5 },
      (_, i) => new File(["x"], `album-active-${i}.jpg`, { type: "image/jpeg" }),
    );
    const deferreds = files.map(() =>
      createDeferred<ReturnType<typeof makeUploadedPhoto>>(),
    );
    const ignoredFile = new File(["ignored"], "album-ignored.jpg", {
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

    fireEvent.click(
      await screen.findByRole("button", { name: /add photos|добавить фото/i }),
    );

    const input = await screen.findByLabelText(
      /jpeg or png files|файлы jpeg или png/i,
    );
    fireEvent.change(input, { target: { files } });

    await waitFor(() => {
      expect(apiMocks.uploadPhoto).toHaveBeenCalledTimes(3);
    });
    expect(input).toBeDisabled();

    fireEvent.change(input, { target: { files: [ignoredFile] } });
    await Promise.resolve();
    await Promise.resolve();

    expect(apiMocks.uploadPhoto).toHaveBeenCalledTimes(3);
    expect(
      apiMocks.uploadPhoto.mock.calls.some(([file]) => file === ignoredFile),
    ).toBe(false);

    for (const [index, deferred] of deferreds.entries()) {
      deferred.resolve(
        makeUploadedPhoto(`album-active-${index}`, files[index]!.name),
      );
    }

    await waitFor(() => {
      expect(apiMocks.addPhotoToAlbum).toHaveBeenCalledTimes(5);
    });
  });

  it("marks expired public share links as expired and keeps revoke disabled", async () => {
    apiMocks.listAlbumShareLinks.mockResolvedValueOnce([
      {
        id: "share-expired",
        albumId: "album-1",
        createdById: "user-1",
        createdAt: "2026-04-05T12:00:00Z",
        expiresAt: "2026-04-05T13:00:00Z",
        revokedAt: null,
      },
    ]);

    renderRoute();

    fireEvent.click(
      await screen.findByRole("button", { name: /share|поделиться/i }),
    );

    expect(await screen.findByText("Expired")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /revoke/i })).toBeDisabled();
  });
});
