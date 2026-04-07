import { fireEvent, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider, LOCALE_STORAGE_KEY } from "~/lib/i18n";
import { ThemeProvider, THEME_STORAGE_KEY } from "~/lib/theme";
import Home from "~/routes/home";

const apiMocks = vi.hoisted(() => ({
  getHealth: vi.fn(),
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

describe("Home route theming", () => {
  beforeEach(() => {
    apiMocks.getHealth.mockResolvedValue({ status: "ok" });
    sessionMocks.useSession.mockReturnValue(null);
    window.localStorage.removeItem(LOCALE_STORAGE_KEY);
  });

  it("renders the public landing route with the persisted dark theme", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");

    const Stub = createRoutesStub([
      {
        path: "/",
        Component: Home,
      },
    ]);

    render(
      <I18nProvider>
        <ThemeProvider>
          <Stub initialEntries={["/"]} />
        </ThemeProvider>
      </I18nProvider>,
    );

    expect(
      screen.getByText("Private Image Network Archive"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create account" }),
    ).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("updates the public landing copy when the locale changes", async () => {
    const Stub = createRoutesStub([
      {
        path: "/",
        Component: Home,
      },
    ]);

    render(
      <I18nProvider>
        <ThemeProvider>
          <Stub initialEntries={["/"]} />
        </ThemeProvider>
      </I18nProvider>,
    );

    expect(
      await screen.findByRole("link", { name: "Create account" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Language"), {
      target: { value: "ru" },
    });

    expect(
      screen.getByRole("link", { name: "Создать аккаунт" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Бэкенд подключён")).toBeInTheDocument();
  });
});
