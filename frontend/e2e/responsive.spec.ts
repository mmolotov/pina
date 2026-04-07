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

test("overview route keeps navigation and key actions reachable", async ({
  page,
}) => {
  await bootstrapAuthenticatedPage(page);
  await mockCoreApi(page);

  await page.goto("/app");

  await expect(
    page.getByRole("heading", { name: /Welcome back, Test User/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open personal library" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Open timeline" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expect(page).toHaveScreenshot("overview-route.png", {
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
    page.getByRole("heading", { name: "Photos and albums" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Everything" })).toBeVisible();
  await expect(page.getByLabel("Filter library")).toBeVisible();
  await expect(page.getByText("Upload photos")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expect(page).toHaveScreenshot("library-route.png", {
    fullPage: true,
    animations: "disabled",
  });
});
