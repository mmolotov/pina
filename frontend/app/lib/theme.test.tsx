import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY, ThemeProvider, useTheme } from "~/lib/theme";

function ThemeProbe() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div>
      <p>Current theme: {theme}</p>
      <button onClick={toggleTheme} type="button">
        Toggle theme
      </button>
    </div>
  );
}

describe("ThemeProvider", () => {
  it("uses the persisted theme preference on mount", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByText("Current theme: dark")).toBeInTheDocument();

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(document.documentElement.style.colorScheme).toBe("dark");
    });
  });

  it("toggles the theme and persists the next preference", async () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByText("Current theme: light")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));

    expect(screen.getByText("Current theme: dark")).toBeInTheDocument();

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    });
  });
});
