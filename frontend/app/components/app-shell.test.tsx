import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "~/components/app-shell";
import { I18nProvider, LOCALE_STORAGE_KEY } from "~/lib/i18n";
import { ThemeProvider } from "~/lib/theme";

const apiMocks = vi.hoisted(() => ({
  getHealth: vi.fn(),
  logout: vi.fn(),
}));

const sessionMocks = vi.hoisted(() => ({
  useSession: vi.fn(),
}));

vi.mock("~/lib/api", () => ({
  ...apiMocks,
}));

vi.mock("~/lib/session", () => ({
  ...sessionMocks,
}));

describe("AppShell", () => {
  function renderWithProviders(children: ReactNode) {
    return render(
      <I18nProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </I18nProvider>,
    );
  }

  function getNavToggle(name: "Open navigation" | "Close navigation") {
    return screen
      .getAllByRole("button", { name })
      .find((element) => element.hasAttribute("aria-expanded"));
  }

  beforeEach(() => {
    apiMocks.getHealth.mockResolvedValue({
      status: "ok",
      storage: {
        type: "local",
        usedBytes: 1024,
        availableBytes: 4096,
      },
    });
    apiMocks.logout.mockResolvedValue(undefined);
    sessionMocks.useSession.mockReturnValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 900,
      receivedAt: Date.now(),
      user: {
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
        avatarUrl: null,
        instanceRole: "USER",
        active: true,
      },
    });
  });

  it("opens and closes mobile navigation", () => {
    const Stub = createRoutesStub([
      {
        path: "/app",
        Component: AppShell,
        children: [
          {
            index: true,
            Component: () => <div>Library content</div>,
          },
        ],
      },
    ]);

    renderWithProviders(<Stub initialEntries={["/app"]} />);

    const menuButton = getNavToggle("Open navigation");
    expect(menuButton).toBeDefined();
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(menuButton!);

    expect(getNavToggle("Close navigation")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getAllByText("Photos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Spaces").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Trash").length).toBeGreaterThan(0);

    fireEvent.click(getNavToggle("Close navigation")!);

    expect(getNavToggle("Open navigation")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("switches theme from the shell and updates the document theme", () => {
    const Stub = createRoutesStub([
      {
        path: "/app",
        Component: AppShell,
        children: [
          {
            index: true,
            Component: () => <div>Library content</div>,
          },
        ],
      },
    ]);

    renderWithProviders(<Stub initialEntries={["/app"]} />);

    fireEvent.click(
      screen.getAllByRole("button", { name: "Switch to dark theme" })[0]!,
    );

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getAllByText("Light theme").length).toBeGreaterThan(0);
  });

  it("renders top controls and filter shortcuts for the media-first shell", () => {
    const Stub = createRoutesStub([
      {
        path: "/app",
        Component: AppShell,
        children: [
          {
            index: true,
            Component: () => <div>Library content</div>,
          },
        ],
      },
    ]);

    renderWithProviders(<Stub initialEntries={["/app"]} />);

    expect(
      screen.getByRole("searchbox", { name: "Search media library" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Upload" })[0]).toHaveAttribute(
      "href",
      "/app/library",
    );

    fireEvent.click(screen.getByRole("button", { name: "Open filters" }));

    expect(
      screen.getByText("Open curated personal collections.").closest("a"),
    ).toHaveAttribute("href", "/app/library?view=albums");
    expect(
      screen.getByText("Switch into place-based browsing.").closest("a"),
    ).toHaveAttribute("href", "/app/library?view=map");
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("shows the admin entry for instance admins", () => {
    sessionMocks.useSession.mockReturnValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 900,
      receivedAt: Date.now(),
      user: {
        id: "admin-1",
        name: "Admin User",
        email: "admin@example.com",
        avatarUrl: null,
        instanceRole: "ADMIN",
        active: true,
      },
    });

    const Stub = createRoutesStub([
      {
        path: "/app",
        Component: AppShell,
        children: [
          {
            index: true,
            Component: () => <div>Library content</div>,
          },
        ],
      },
    ]);

    renderWithProviders(<Stub initialEntries={["/app"]} />);

    expect(screen.getAllByText("Admin").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Instance control").length).toBeGreaterThan(0);
  });

  it("switches the active language from the shell and persists it", () => {
    const Stub = createRoutesStub([
      {
        path: "/app",
        Component: AppShell,
        children: [
          {
            index: true,
            Component: () => <div>Library content</div>,
          },
        ],
      },
    ]);

    renderWithProviders(<Stub initialEntries={["/app"]} />);

    fireEvent.change(screen.getByLabelText("Language"), {
      target: { value: "ru" },
    });

    expect(document.documentElement.lang).toBe("ru");
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("ru");
  });
});
