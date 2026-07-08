import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Behavioural e2e coverage (no screenshots): the auth guard on /app and the
// anonymous share-link album page — both bypassed by responsive.spec.ts,
// which always boots with a session and never leaves the app shell.

const publicAlbumResponse = {
  album: {
    id: "album-1",
    name: "Trip to Kotor",
    description: "Long weekend by the bay",
    photoCount: 2,
    mediaRangeStart: "2026-05-01T09:00:00Z",
    mediaRangeEnd: "2026-05-03T18:00:00Z",
  },
  photos: {
    items: [
      {
        id: "photo-1",
        originalFilename: "bay.jpg",
        width: 1600,
        height: 900,
        takenAt: "2026-05-01T09:00:00Z",
      },
      {
        id: "photo-2",
        originalFilename: "old-town.jpg",
        width: 1200,
        height: 1600,
        takenAt: "2026-05-02T12:00:00Z",
      },
    ],
    page: 0,
    size: 60,
    hasNext: false,
    totalItems: 2,
    totalPages: 1,
  },
};

// 1x1 transparent PNG so <img> requests resolve without a backend.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

async function mockPublicAlbumApi(page: Page, valid: boolean) {
  await page.route("**/api/v1/public/albums/by-token/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes("/photos/")) {
      return route.fulfill({
        status: 200,
        contentType: "image/png",
        body: PIXEL,
      });
    }
    if (!valid) {
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          error: "not_found",
          message: "Share link not found",
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(publicAlbumResponse),
    });
  });
}

test("visiting the app without a session redirects to login with a return path", async ({
  page,
}) => {
  await page.goto("/app/library");

  await expect(page).toHaveURL(/\/login\?redirect=%2Fapp%2Flibrary/);
  await expect(
    page.getByRole("heading", { name: "Log in to PINA" }),
  ).toBeVisible();
});

test("a valid share token renders the album for anonymous visitors", async ({
  page,
}) => {
  await mockPublicAlbumApi(page, true);

  await page.goto("/s/album/test-token");

  await expect(
    page.getByRole("heading", { name: "Trip to Kotor" }),
  ).toBeVisible();
  await expect(page.getByText("Long weekend by the bay")).toBeVisible();
  await expect(page.getByText("2 photos")).toBeVisible();
  await expect(page.getByRole("img", { name: "bay.jpg" })).toBeVisible();
  await expect(page.getByRole("img", { name: "old-town.jpg" })).toBeVisible();
  // Thumbnails must link to the original variant download.
  await expect(
    page.locator('a[href*="variant=ORIGINAL"]').first(),
  ).toBeVisible();
});

test("an invalid share token shows the not-found message with a way home", async ({
  page,
}) => {
  await mockPublicAlbumApi(page, false);

  await page.goto("/s/album/expired-token");

  await expect(page.getByText("Shared album")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back home" })).toBeVisible();
});
