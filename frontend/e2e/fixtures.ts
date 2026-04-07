import type { Page, Route } from "@playwright/test";

const SESSION_STORAGE_KEY = "pina.session";

const sessionPayload = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresIn: 900,
  receivedAt: 1_775_000_000_000,
  user: {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    avatarUrl: null,
  },
};

const healthResponse = {
  status: "ok",
  storage: {
    type: "local",
    usedBytes: 1024,
    availableBytes: 2048,
  },
};

const photosPage = {
  items: [
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
      latitude: 44.8176,
      longitude: 20.4633,
      createdAt: "2026-04-02T10:05:00Z",
      variants: [],
    },
  ],
  page: 0,
  size: 100,
  hasNext: false,
  totalItems: 1,
  totalPages: 1,
};

const spacesResponse = [
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
];

const emptyPage = {
  items: [],
  page: 0,
  size: 100,
  hasNext: false,
  totalItems: 0,
  totalPages: 0,
};

function fulfillJson(route: Route, body: unknown) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export async function bootstrapAuthenticatedPage(page: Page) {
  await page.addInitScript(
    ([key, payload]) => {
      window.sessionStorage.setItem(key, payload);
    },
    [SESSION_STORAGE_KEY, JSON.stringify(sessionPayload)] as const,
  );
}

export async function mockCoreApi(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const type = url.searchParams.get("type");

    if (path === "/api/v1/health") {
      return fulfillJson(route, healthResponse);
    }

    if (path === "/api/v1/photos") {
      return fulfillJson(route, photosPage);
    }

    if (path === "/api/v1/albums") {
      return fulfillJson(route, emptyPage);
    }

    if (path === "/api/v1/favorites") {
      if (type === "PHOTO" || type === "ALBUM" || type == null) {
        return fulfillJson(route, emptyPage);
      }
    }

    if (path === "/api/v1/photos/geo") {
      return fulfillJson(route, emptyPage);
    }

    if (path === "/api/v1/spaces") {
      return fulfillJson(route, spacesResponse);
    }

    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        error: "mock_not_found",
        message: `No Playwright mock for ${path}`,
      }),
    });
  });
}
