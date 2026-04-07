import { fireEvent, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "~/lib/i18n";
import AppFavoritesRoute, {
  clientLoader as appFavoritesClientLoader,
} from "~/routes/app-favorites";

const apiMocks = vi.hoisted(() => ({
  listFavorites: vi.fn(),
  listAllPhotos: vi.fn(),
  listAlbums: vi.fn(),
  listSpaces: vi.fn(),
  listSpaceAlbums: vi.fn(),
}));

vi.mock("~/lib/api", () => ({
  ...apiMocks,
}));

describe("AppFavoritesRoute", () => {
  beforeEach(() => {
    apiMocks.listFavorites.mockImplementation(async (targetType?: string) => {
      if (targetType === "PHOTO") {
        return [
          {
            id: "favorite-photo-1",
            userId: "user-1",
            targetType: "PHOTO",
            targetId: "photo-1",
            createdAt: "2026-04-02T10:20:00Z",
          },
        ];
      }

      if (targetType === "ALBUM") {
        return [
          {
            id: "favorite-album-1",
            userId: "user-1",
            targetType: "ALBUM",
            targetId: "album-space-1",
            createdAt: "2026-04-02T10:22:00Z",
          },
        ];
      }

      return [];
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
    apiMocks.listSpaceAlbums.mockResolvedValue([
      {
        id: "album-space-1",
        name: "Weekend highlights",
        description: "Shared shots",
        ownerId: "user-1",
        personalLibraryId: null,
        spaceId: "space-1",
        createdAt: "2026-04-02T10:00:00Z",
        updatedAt: "2026-04-02T10:00:00Z",
      },
    ]);
  });

  function renderRoute() {
    const Stub = createRoutesStub([
      {
        path: "/app/favorites",
        Component: AppFavoritesRoute,
        loader: async () => appFavoritesClientLoader(),
      },
    ]);

    return render(
      <I18nProvider>
        <Stub initialEntries={["/app/favorites"]} />
      </I18nProvider>,
    );
  }

  it("renders photo and album favorites and filters to albums", async () => {
    renderRoute();

    expect(await screen.findByText("beach.jpg")).toBeInTheDocument();
    expect(screen.getByText("Weekend highlights")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /albums|альбомы/i }));

    expect(screen.getByRole("link", { name: /family space/i })).toHaveAttribute(
      "href",
      "/app/spaces/space-1",
    );
  });

  it("filters favorites by text", async () => {
    renderRoute();

    expect(await screen.findByText("beach.jpg")).toBeInTheDocument();

    fireEvent.change(
      screen.getByLabelText(/filter favorites|фильтр избранного/i),
      {
        target: { value: "weekend" },
      },
    );

    expect(screen.queryByText("beach.jpg")).not.toBeInTheDocument();
    expect(screen.getByText("Weekend highlights")).toBeInTheDocument();
  });

  it("renders favorite photos that come from the fully loaded library set", async () => {
    apiMocks.listFavorites.mockImplementation(async (targetType?: string) => {
      if (targetType === "PHOTO") {
        return [
          {
            id: "favorite-photo-2",
            userId: "user-1",
            targetType: "PHOTO",
            targetId: "photo-2",
            createdAt: "2026-04-02T10:25:00Z",
          },
        ];
      }

      if (targetType === "ALBUM") {
        return [];
      }

      return [];
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
      {
        id: "photo-2",
        uploaderId: "user-1",
        originalFilename: "mountain.jpg",
        mimeType: "image/jpeg",
        width: 2048,
        height: 1365,
        sizeBytes: 612000,
        personalLibraryId: "library-1",
        exifData: null,
        takenAt: null,
        createdAt: "2026-04-02T10:06:00Z",
        variants: [],
      },
    ]);

    const data = await appFavoritesClientLoader();

    expect(data.favoritePhotos).toHaveLength(1);
    expect(data.favoritePhotos[0]?.photo.originalFilename).toBe("mountain.jpg");
  });
});
