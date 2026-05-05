import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "~/lib/i18n";
import AppSearchRoute, {
  clientLoader as appSearchClientLoader,
} from "~/routes/app-search";
import type { PageResponse, SearchHitDto } from "~/types/api";

const apiMocks = vi.hoisted(() => ({
  listPhotos: vi.fn(),
  listSpaces: vi.fn(),
  listFavorites: vi.fn(),
  searchMedia: vi.fn(),
}));

vi.mock("~/lib/api", () => {
  class ApiError extends Error {
    status: number;
    code: string;

    constructor(status: number, code: string, message: string) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.code = code;
    }
  }

  return {
    ...apiMocks,
    ApiError,
    isBackendUnavailableError: (error: unknown) =>
      error instanceof ApiError &&
      (error.code === "backend_unavailable" || error.status === 503),
  };
});

function createSearchPage(
  items: SearchHitDto[],
  overrides: Partial<PageResponse<SearchHitDto>> = {},
): PageResponse<SearchHitDto> {
  return {
    items,
    page: overrides.page ?? 0,
    size: overrides.size ?? 24,
    hasNext: overrides.hasNext ?? false,
    totalItems: overrides.totalItems ?? items.length,
    totalPages: overrides.totalPages ?? (items.length === 0 ? 0 : 1),
  };
}

describe("AppSearchRoute", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    apiMocks.listPhotos.mockResolvedValue({
      items: [],
      page: 0,
      size: 1,
      hasNext: true,
      totalItems: 12,
      totalPages: 12,
    });
    apiMocks.listSpaces.mockResolvedValue([
      {
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
      },
    ]);
    apiMocks.listFavorites.mockResolvedValue([]);
    apiMocks.searchMedia.mockResolvedValue(createSearchPage([]));
  });

  function renderRoute(initialEntries = ["/app/search"]) {
    const Stub = createRoutesStub([
      {
        path: "/app/search",
        Component: AppSearchRoute,
        loader: async () => appSearchClientLoader(),
      },
    ]);

    return render(
      <I18nProvider>
        <Stub initialEntries={initialEntries} />
      </I18nProvider>,
    );
  }

  it("renders backend search results for photo and album hits", async () => {
    apiMocks.searchMedia.mockResolvedValue(
      createSearchPage([
        {
          kind: "PHOTO",
          entryScope: "LIBRARY",
          favorited: true,
          photo: {
            photo: {
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
              latitude: null,
              longitude: null,
              createdAt: "2026-04-02T10:05:00Z",
              variants: [],
            },
            albumId: null,
            albumName: null,
            spaceId: null,
            spaceName: null,
          },
          album: null,
        },
        {
          kind: "ALBUM",
          entryScope: "SPACES",
          favorited: false,
          photo: null,
          album: {
            album: {
              id: "album-1",
              name: "Beach Finds",
              description: "Pinned beach album",
              ownerId: "user-1",
              personalLibraryId: null,
              spaceId: "space-1",
              createdAt: "2026-04-02T10:05:00Z",
              updatedAt: "2026-04-02T10:05:00Z",
              coverPhotoId: null,
              coverVariants: [],
              photoCount: 1,
              mediaRangeStart: "2026-04-02T10:05:00Z",
              mediaRangeEnd: "2026-04-02T10:05:00Z",
              latestPhotoAddedAt: "2026-04-02T10:05:00Z",
              previewPhotos: [],
            },
            spaceId: "space-1",
            spaceName: "Family Space",
          },
        },
      ]),
    );

    renderRoute();

    expect(
      await screen.findByText(/discovery|обнаружение/i),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/search query|поисковый запрос/i), {
      target: { value: "beach" },
    });

    expect(await screen.findByText("beach.jpg")).toBeInTheDocument();
    expect(await screen.findByText("Beach Finds")).toBeInTheDocument();
    expect(apiMocks.searchMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "beach",
        page: 0,
        size: 24,
        needsTotal: true,
      }),
    );
  });

  it("shows loading and backend error states", async () => {
    let rejectSearch: ((reason?: unknown) => void) | undefined;
    apiMocks.searchMedia.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectSearch = reject;
        }),
    );

    renderRoute();

    expect(
      await screen.findByText(/discovery|обнаружение/i),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/search query|поисковый запрос/i), {
      target: { value: "family" },
    });

    expect(
      await screen.findByText(
        /loading backend search results|загружаю backend/i,
      ),
    ).toBeInTheDocument();

    rejectSearch?.(new Error("Backend is unavailable."));

    expect(
      await screen.findByText(/backend is unavailable|недоступен/i),
    ).toBeInTheDocument();
  });

  it("restores url-driven search state and forwards filters to the backend", async () => {
    apiMocks.searchMedia.mockResolvedValue(
      createSearchPage([
        {
          kind: "PHOTO",
          entryScope: "SPACES",
          favorited: false,
          photo: {
            photo: {
              id: "photo-space-1",
              uploaderId: "user-2",
              originalFilename: "family-dinner.jpg",
              mimeType: "image/jpeg",
              width: 1600,
              height: 900,
              sizeBytes: 256000,
              personalLibraryId: "library-2",
              exifData: null,
              takenAt: null,
              latitude: null,
              longitude: null,
              createdAt: "2026-04-02T10:05:00Z",
              variants: [],
            },
            albumId: "album-space-1",
            albumName: "Family Album",
            spaceId: "space-1",
            spaceName: "Family Space",
          },
          album: null,
        },
      ]),
    );

    renderRoute([
      "/app/search?q=family&scope=favorites&kind=photo&sort=oldest&page=1",
    ]);

    await waitFor(() => {
      expect(
        screen.getByLabelText(/search query|поисковый запрос/i),
      ).toHaveValue("family");
    });
    expect(
      screen.getByRole("button", { name: /favorites|избранное/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("combobox", { name: /sort|сортировка/i }),
    ).toHaveValue("oldest");
    expect(await screen.findByText("family-dinner.jpg")).toBeInTheDocument();
    expect(apiMocks.searchMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "family",
        scope: "favorites",
        kind: "photo",
        sort: "oldest",
        page: 1,
      }),
    );
  });

  it("supports previous and next pagination controls without losing the active query", async () => {
    apiMocks.searchMedia.mockImplementation(
      async (params: { page?: number }) => {
        if (params.page === 1) {
          return createSearchPage(
            [
              {
                kind: "PHOTO",
                entryScope: "LIBRARY",
                favorited: false,
                photo: {
                  photo: {
                    id: "photo-2",
                    uploaderId: "user-1",
                    originalFilename: "beach-page-2.jpg",
                    mimeType: "image/jpeg",
                    width: 1400,
                    height: 900,
                    sizeBytes: 180000,
                    personalLibraryId: "library-1",
                    exifData: null,
                    takenAt: null,
                    latitude: null,
                    longitude: null,
                    createdAt: "2026-04-02T10:05:00Z",
                    variants: [],
                  },
                  albumId: null,
                  albumName: null,
                  spaceId: null,
                  spaceName: null,
                },
                album: null,
              },
            ],
            { page: 1, hasNext: false, totalItems: 30, totalPages: 2 },
          );
        }

        return createSearchPage(
          [
            {
              kind: "PHOTO",
              entryScope: "LIBRARY",
              favorited: false,
              photo: {
                photo: {
                  id: "photo-1",
                  uploaderId: "user-1",
                  originalFilename: "beach-page-1.jpg",
                  mimeType: "image/jpeg",
                  width: 1400,
                  height: 900,
                  sizeBytes: 180000,
                  personalLibraryId: "library-1",
                  exifData: null,
                  takenAt: null,
                  latitude: null,
                  longitude: null,
                  createdAt: "2026-04-02T10:05:00Z",
                  variants: [],
                },
                albumId: null,
                albumName: null,
                spaceId: null,
                spaceName: null,
              },
              album: null,
            },
          ],
          { page: 0, hasNext: true, totalItems: 30, totalPages: 2 },
        );
      },
    );

    renderRoute(["/app/search?q=beach"]);

    expect(await screen.findByText("beach-page-1.jpg")).toBeInTheDocument();
    expect(
      screen.getByText(/page 1 of 2|страница 1 из 2/i),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /next page|следующая страница/i }),
    );

    expect(await screen.findByText("beach-page-2.jpg")).toBeInTheDocument();
    expect(
      screen.getByText(/page 2 of 2|страница 2 из 2/i),
    ).toBeInTheDocument();
    expect(apiMocks.searchMedia).toHaveBeenLastCalledWith(
      expect.objectContaining({
        q: "beach",
        page: 1,
      }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /previous page|предыдущая страница/i,
      }),
    );

    expect(await screen.findByText("beach-page-1.jpg")).toBeInTheDocument();
    expect(apiMocks.searchMedia).toHaveBeenLastCalledWith(
      expect.objectContaining({
        q: "beach",
        page: 0,
      }),
    );
  });

  it("recovers from a stale page parameter when earlier pages still contain results", async () => {
    apiMocks.searchMedia.mockImplementation(
      async (params: { page?: number }) => {
        if (params.page === 3) {
          return createSearchPage([], {
            page: 3,
            hasNext: false,
            totalItems: 30,
            totalPages: 2,
          });
        }

        return createSearchPage(
          [
            {
              kind: "PHOTO",
              entryScope: "LIBRARY",
              favorited: false,
              photo: {
                photo: {
                  id: "photo-recovered",
                  uploaderId: "user-1",
                  originalFilename: "beach-recovered.jpg",
                  mimeType: "image/jpeg",
                  width: 1400,
                  height: 900,
                  sizeBytes: 180000,
                  personalLibraryId: "library-1",
                  exifData: null,
                  takenAt: null,
                  latitude: null,
                  longitude: null,
                  createdAt: "2026-04-02T10:05:00Z",
                  variants: [],
                },
                albumId: null,
                albumName: null,
                spaceId: null,
                spaceName: null,
              },
              album: null,
            },
          ],
          { page: 1, hasNext: false, totalItems: 30, totalPages: 2 },
        );
      },
    );

    renderRoute(["/app/search?q=beach&page=3"]);

    expect(await screen.findByText("beach-recovered.jpg")).toBeInTheDocument();
    expect(
      screen.getByText(/page 2 of 2|страница 2 из 2/i),
    ).toBeInTheDocument();
    expect(apiMocks.searchMedia).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        q: "beach",
        page: 3,
      }),
    );
    expect(apiMocks.searchMedia).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        q: "beach",
        page: 1,
      }),
    );
    expect(
      screen.queryByText(
        /no backend search results match|нет backend search results/i,
      ),
    ).not.toBeInTheDocument();
  });
});
