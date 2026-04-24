import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "~/lib/i18n";
import PublicAlbumRoute from "~/routes/public-album";

const apiMocks = vi.hoisted(() => ({
  buildPublicAlbumPhotoFileUrl: vi.fn(),
  fetchPublicAlbumByToken: vi.fn(),
}));

vi.mock("~/lib/api", async () => {
  const actual = await vi.importActual<typeof import("~/lib/api")>("~/lib/api");
  return {
    ...actual,
    buildPublicAlbumPhotoFileUrl: apiMocks.buildPublicAlbumPhotoFileUrl,
    fetchPublicAlbumByToken: apiMocks.fetchPublicAlbumByToken,
  };
});

describe("PublicAlbumRoute", () => {
  it("renders the shared album viewer and loads additional pages", async () => {
    apiMocks.buildPublicAlbumPhotoFileUrl.mockImplementation(
      (token: string, photoId: string, variant: string) =>
        `/public/${token}/${photoId}/${variant}`,
    );
    apiMocks.fetchPublicAlbumByToken.mockResolvedValue({
      album: {
        id: "album-1",
        name: "Shared summer",
        description: "A few public highlights",
        createdAt: "2026-04-01T10:00:00Z",
        updatedAt: "2026-04-05T18:30:00Z",
        coverPhotoId: "photo-1",
        coverVariants: [],
        photoCount: 3,
        mediaRangeStart: "2026-04-01T09:00:00Z",
        mediaRangeEnd: "2026-04-03T11:00:00Z",
        latestPhotoAddedAt: "2026-04-05T18:30:00Z",
      },
      photos: {
        items: [
          {
            id: "photo-3",
            originalFilename: "lanterns.jpg",
            mimeType: "image/jpeg",
            width: 1200,
            height: 1200,
            sizeBytes: 220000,
            takenAt: "2026-04-03T11:00:00Z",
            createdAt: "2026-04-03T11:00:00Z",
            variants: [],
          },
        ],
        page: 1,
        size: 60,
        hasNext: false,
        totalItems: 3,
        totalPages: 2,
      },
    });

    const Stub = createRoutesStub([
      {
        path: "/s/album/:token",
        Component: PublicAlbumRoute,
        loader: async () => ({
          ok: true as const,
          data: {
            album: {
              id: "album-1",
              name: "Shared summer",
              description: "A few public highlights",
              createdAt: "2026-04-01T10:00:00Z",
              updatedAt: "2026-04-05T18:30:00Z",
              coverPhotoId: "photo-1",
              coverVariants: [],
              photoCount: 3,
              mediaRangeStart: "2026-04-01T09:00:00Z",
              mediaRangeEnd: "2026-04-03T11:00:00Z",
              latestPhotoAddedAt: "2026-04-05T18:30:00Z",
            },
            photos: {
              items: [
                {
                  id: "photo-1",
                  originalFilename: "pier.jpg",
                  mimeType: "image/jpeg",
                  width: 1200,
                  height: 1200,
                  sizeBytes: 210000,
                  takenAt: "2026-04-01T09:00:00Z",
                  createdAt: "2026-04-01T09:00:00Z",
                  variants: [],
                },
                {
                  id: "photo-2",
                  originalFilename: "market.jpg",
                  mimeType: "image/jpeg",
                  width: 1200,
                  height: 1200,
                  sizeBytes: 215000,
                  takenAt: "2026-04-02T10:00:00Z",
                  createdAt: "2026-04-02T10:00:00Z",
                  variants: [],
                },
              ],
              page: 0,
              size: 60,
              hasNext: true,
              totalItems: 3,
              totalPages: 2,
            },
          },
        }),
      },
    ]);

    render(
      <I18nProvider>
        <Stub initialEntries={["/s/album/share-token-1"]} />
      </I18nProvider>,
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "Shared summer" }),
    ).toBeInTheDocument();
    expect(screen.getByText("A few public highlights")).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link")
        .some(
          (link) =>
            link.getAttribute("href") ===
            "/public/share-token-1/photo-1/ORIGINAL",
        ),
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /load more/i }));

    await waitFor(() => {
      expect(apiMocks.fetchPublicAlbumByToken).toHaveBeenCalledWith(
        "share-token-1",
        {
          page: 1,
          size: 60,
        },
      );
    });
    expect(await screen.findByAltText("lanterns.jpg")).toBeInTheDocument();
  });

  it("renders the not-found state for revoked or expired links", async () => {
    const Stub = createRoutesStub([
      {
        path: "/s/album/:token",
        Component: PublicAlbumRoute,
        loader: async () => ({ ok: false as const, status: 404 }),
      },
    ]);

    render(
      <I18nProvider>
        <Stub initialEntries={["/s/album/revoked-token"]} />
      </I18nProvider>,
    );

    expect(await screen.findByText(/no longer available/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back home/i })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
