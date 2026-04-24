import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => {
  let currentSession: {
    accessToken: string;
    refreshToken: string;
    user: null;
    receivedAt: number;
  } | null = null;

  return {
    getSessionSnapshot: vi.fn(() => currentSession),
    persistSession: vi.fn(
      (authResponse: {
        accessToken: string;
        refreshToken: string;
        user: null;
      }) => {
        currentSession = {
          ...authResponse,
          receivedAt: Date.now(),
        };
      },
    ),
    clearSession: vi.fn(() => {
      currentSession = null;
    }),
    setSession(session: typeof currentSession) {
      currentSession = session;
    },
  };
});

vi.mock("~/lib/session", () => ({
  clearSession: sessionMocks.clearSession,
  getSessionSnapshot: sessionMocks.getSessionSnapshot,
  persistSession: sessionMocks.persistSession,
}));

import {
  createAlbumArchiveDownloadUrl,
  getPhotoBlob,
  listAlbums,
  listAllPhotos,
  listGeoPhotos,
  listNearbyGeoPhotos,
  listAllSpaceAlbumPhotos,
  listFavorites,
  listSpaceAlbums,
  listSpaceInvites,
  listSpaceMembers,
} from "~/lib/api";

describe("api helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionMocks.clearSession.mockClear();
    sessionMocks.getSessionSnapshot.mockClear();
    sessionMocks.persistSession.mockClear();
    sessionMocks.setSession({
      accessToken: "expired-access-token",
      refreshToken: "refresh-token",
      user: null,
      receivedAt: 1,
    });
  });

  it("retries blob requests after refreshing an expired session", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: "fresh-access-token",
            refreshToken: "fresh-refresh-token",
            user: null,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response("preview", {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const blob = await getPhotoBlob("photo-1");

    expect(blob).toBeInstanceOf(Blob);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/photos/photo-1/file?variant=COMPRESSED",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/auth/refresh",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/v1/photos/photo-1/file?variant=COMPRESSED",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    expect(
      (
        fetchMock.mock.calls[0]?.[1] as { headers: Headers } | undefined
      )?.headers.get("Authorization"),
    ).toBe("Bearer expired-access-token");
    expect(
      (
        fetchMock.mock.calls[2]?.[1] as { headers: Headers } | undefined
      )?.headers.get("Authorization"),
    ).toBe("Bearer fresh-access-token");
    expect(sessionMocks.persistSession).toHaveBeenCalledWith({
      accessToken: "fresh-access-token",
      refreshToken: "fresh-refresh-token",
      user: null,
    });
  });

  it("requests a signed album download URL without reading a blob", async () => {
    const blobSpy = vi.fn();
    const textSpy = vi.fn().mockResolvedValue(
      JSON.stringify({
        url: "/api/v1/albums/album-1/download-by-token?token=signed-token",
        expiresAt: "2026-04-06T12:05:00Z",
      }),
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "application/json" }),
      text: textSpy,
      blob: blobSpy,
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await createAlbumArchiveDownloadUrl("album-1", "ORIGINAL");

    expect(result).toEqual({
      url: "/api/v1/albums/album-1/download-by-token?token=signed-token",
      expiresAt: "2026-04-06T12:05:00Z",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/albums/album-1/download-url?variant=ORIGINAL",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
      }),
    );
    expect(blobSpy).not.toHaveBeenCalled();
  });

  it("loads all personal photos across paginated responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ id: "photo-1" }, { id: "photo-2" }],
            page: 0,
            size: 2,
            hasNext: true,
            totalItems: 3,
            totalPages: 2,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ id: "photo-3" }],
            page: 1,
            size: 2,
            hasNext: false,
            totalItems: 3,
            totalPages: 2,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const photos = await listAllPhotos(2);

    expect(photos).toHaveLength(3);
    expect(photos.map((photo) => photo.id)).toEqual([
      "photo-1",
      "photo-2",
      "photo-3",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/photos?page=0&size=2&needsTotal=true",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/photos?page=1&size=2&needsTotal=true",
      expect.any(Object),
    );
  });

  it("loads all shared album photos across paginated responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ id: "photo-1" }],
            page: 0,
            size: 1,
            hasNext: true,
            totalItems: 2,
            totalPages: 2,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ id: "photo-2" }],
            page: 1,
            size: 1,
            hasNext: false,
            totalItems: 2,
            totalPages: 2,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const photos = await listAllSpaceAlbumPhotos("space-1", "album-1", 1);

    expect(photos).toHaveLength(2);
    expect(photos.map((photo) => photo.id)).toEqual(["photo-1", "photo-2"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/spaces/space-1/albums/album-1/photos?page=0&size=1&needsTotal=true",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/spaces/space-1/albums/album-1/photos?page=1&size=1&needsTotal=true",
      expect.any(Object),
    );
  });

  it("loads all albums across paginated responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ id: "album-1" }],
            page: 0,
            size: 1,
            hasNext: true,
            totalItems: 2,
            totalPages: 2,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ id: "album-2" }],
            page: 1,
            size: 1,
            hasNext: false,
            totalItems: 2,
            totalPages: 2,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const albums = await listAlbums({ size: 1 });

    expect(albums.map((album) => album.id)).toEqual(["album-1", "album-2"]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/albums?page=0&size=1&needsTotal=true",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/albums?page=1&size=1&needsTotal=true",
      expect.any(Object),
    );
  });

  it("sends album sort and direction query params when requested", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [{ id: "album-1" }],
          page: 0,
          size: 1,
          hasNext: false,
          totalItems: 1,
          totalPages: 1,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    await listAlbums({ size: 1, sort: "updatedAt", direction: "asc" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/albums?page=0&size=1&needsTotal=true&sort=updatedAt&direction=asc",
      expect.any(Object),
    );
  });

  it("loads all space members across paginated responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ userId: "user-1" }],
            page: 0,
            size: 1,
            hasNext: true,
            totalItems: 2,
            totalPages: 2,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ userId: "user-2" }],
            page: 1,
            size: 1,
            hasNext: false,
            totalItems: 2,
            totalPages: 2,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const members = await listSpaceMembers("space-1", 1);

    expect(members.map((member) => member.userId)).toEqual([
      "user-1",
      "user-2",
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/spaces/space-1/members?page=0&size=1&needsTotal=true",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/spaces/space-1/members?page=1&size=1&needsTotal=true",
      expect.any(Object),
    );
  });

  it("loads all space albums across paginated responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ id: "space-album-1" }],
            page: 0,
            size: 1,
            hasNext: true,
            totalItems: 2,
            totalPages: 2,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ id: "space-album-2" }],
            page: 1,
            size: 1,
            hasNext: false,
            totalItems: 2,
            totalPages: 2,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const albums = await listSpaceAlbums("space-1", 1);

    expect(albums.map((album) => album.id)).toEqual([
      "space-album-1",
      "space-album-2",
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/spaces/space-1/albums?page=0&size=1&needsTotal=true",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/spaces/space-1/albums?page=1&size=1&needsTotal=true",
      expect.any(Object),
    );
  });

  it("loads all space invites across paginated responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ id: "invite-1" }],
            page: 0,
            size: 1,
            hasNext: true,
            totalItems: 2,
            totalPages: 2,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ id: "invite-2" }],
            page: 1,
            size: 1,
            hasNext: false,
            totalItems: 2,
            totalPages: 2,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const invites = await listSpaceInvites("space-1", 1);

    expect(invites.map((invite) => invite.id)).toEqual([
      "invite-1",
      "invite-2",
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/spaces/space-1/invites?page=0&size=1&needsTotal=true",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/spaces/space-1/invites?page=1&size=1&needsTotal=true",
      expect.any(Object),
    );
  });

  it("loads all favorites across paginated responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ id: "favorite-1", targetId: "photo-1" }],
            page: 0,
            size: 1,
            hasNext: true,
            totalItems: 2,
            totalPages: 2,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ id: "favorite-2", targetId: "photo-2" }],
            page: 1,
            size: 1,
            hasNext: false,
            totalItems: 2,
            totalPages: 2,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const favorites = await listFavorites("PHOTO", 1);

    expect(favorites.map((favorite) => favorite.id)).toEqual([
      "favorite-1",
      "favorite-2",
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/favorites?page=0&size=1&needsTotal=true&type=PHOTO",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/favorites?page=1&size=1&needsTotal=true&type=PHOTO",
      expect.any(Object),
    );
  });

  it("serializes viewport geo search params", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "photo-1",
              uploaderId: "user-1",
              originalFilename: "map.jpg",
              mimeType: "image/jpeg",
              width: 1200,
              height: 800,
              sizeBytes: 2048,
              personalLibraryId: "library-1",
              exifData: null,
              takenAt: null,
              latitude: 44.8,
              longitude: 20.5,
              createdAt: "2026-04-03T10:00:00Z",
              variants: [],
            },
          ],
          page: 0,
          size: 25,
          hasNext: false,
          totalItems: 1,
          totalPages: 1,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const response = await listGeoPhotos({
      swLat: 40.1,
      swLng: 18.2,
      neLat: 48.3,
      neLng: 24.4,
      page: 2,
      size: 25,
      needsTotal: false,
    });

    expect(response.items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/photos/geo?swLat=40.1&swLng=18.2&neLat=48.3&neLng=24.4&page=2&size=25&needsTotal=false",
      expect.any(Object),
    );
  });

  it("serializes nearby geo search params", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [],
          page: 0,
          size: 10,
          hasNext: false,
          totalItems: 0,
          totalPages: 0,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    await listNearbyGeoPhotos({
      lat: 44.5,
      lng: 20.2,
      radiusKm: 7.5,
      page: 1,
      size: 10,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/photos/geo/nearby?lat=44.5&lng=20.2&radiusKm=7.5&page=1&size=10&needsTotal=true",
      expect.any(Object),
    );
  });

  it("rejects invalid geo photo responses", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "photo-1",
              uploaderId: "user-1",
              originalFilename: "broken.jpg",
              mimeType: "image/jpeg",
              width: 1200,
              height: 800,
              sizeBytes: 2048,
              personalLibraryId: "library-1",
              exifData: null,
              takenAt: null,
              latitude: "north",
              longitude: 20.5,
              createdAt: "2026-04-03T10:00:00Z",
              variants: [],
            },
          ],
          page: 0,
          size: 100,
          hasNext: false,
          totalItems: 1,
          totalPages: 1,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listGeoPhotos({
        swLat: 40,
        swLng: 18,
        neLat: 48,
        neLng: 24,
      }),
    ).rejects.toMatchObject({
      code: "invalid_response",
      message: "Geo photo response is not valid.",
    });
  });
});
