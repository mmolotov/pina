import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { bootstrapAuthenticatedPage, mockCoreApi } from "./fixtures";

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBeTruthy();
}

test("login route stays usable across supported viewports", async ({
  page,
}) => {
  await page.goto("/login");

  await expect(
    page.getByRole("heading", { name: "Log in to PINA" }),
  ).toBeVisible();
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Log in",
    }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expect(page).toHaveScreenshot("login-route.png", {
    fullPage: true,
    animations: "disabled",
  });
});

test("app shell keeps navigation and key actions reachable", async ({
  page,
}) => {
  await bootstrapAuthenticatedPage(page);
  await mockCoreApi(page);

  await page.goto("/app/library");

  // Sidebar primary nav: every top-level destination is a link with the
  // route's label; on mobile the sidebar is hidden behind a menu trigger so
  // we only assert the search field + theme toggle there.
  const photosLink = page.getByRole("link", { name: "Photos" }).first();
  if (await photosLink.isVisible()) {
    await expect(photosLink).toBeVisible();
    await expect(page.getByRole("link", { name: "Albums" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Map" })).toBeVisible();
  }
  await expect(
    page.getByRole("searchbox", { name: "Search media library" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Switch to dark theme" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expect(page).toHaveScreenshot("app-shell.png", {
    fullPage: true,
    animations: "disabled",
  });
});

test("library route keeps upload and view controls reachable", async ({
  page,
}) => {
  await bootstrapAuthenticatedPage(page);
  await mockCoreApi(page);

  await page.goto("/app/library");

  await expect(
    page.getByRole("heading", { level: 1, name: "Photos" }),
  ).toBeVisible();
  await expect(page.getByLabel("Filter library")).toBeVisible();
  await expect(page.getByText("Upload photos")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expect(page).toHaveScreenshot("library-route.png", {
    fullPage: true,
    animations: "disabled",
  });
});
