import { fireEvent, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "~/components/app-shell";

const apiMocks = vi.hoisted(() => ({
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
  beforeEach(() => {
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
            Component: () => <div>Overview content</div>,
          },
        ],
      },
    ]);

    render(<Stub initialEntries={["/app"]} />);

    const menuButton = screen.getByRole("button", { name: "Open navigation" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(menuButton);

    expect(
      screen.getByRole("button", { name: "Close navigation" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText("Library").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Search").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Close navigation" }));

    expect(
      screen.getByRole("button", { name: "Open navigation" }),
    ).toHaveAttribute("aria-expanded", "false");
  });
});
