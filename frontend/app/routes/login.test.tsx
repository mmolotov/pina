import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "~/lib/i18n";
import LoginRoute, { clientAction as loginClientAction } from "~/routes/login";

const apiMocks = vi.hoisted(() => ({
  login: vi.fn(),
}));

const sessionMocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  persistSession: vi.fn(),
}));

vi.mock("~/lib/api", () => ({
  ...apiMocks,
  ApiError: class ApiError extends Error {
    status: number;
    code: string;

    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

vi.mock("~/lib/session", () => ({
  ...sessionMocks,
}));

describe("LoginRoute", () => {
  beforeEach(() => {
    sessionMocks.useSession.mockReturnValue(null);
    apiMocks.login.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 900,
      user: {
        id: "user-1",
        name: "Manual User",
        email: "manual@example.com",
        avatarUrl: null,
        instanceRole: "USER",
        active: true,
      },
    });
  });

  it("logs the user in through the route action and persists the session", async () => {
    const Stub = createRoutesStub([
      {
        path: "/login",
        Component: LoginRoute,
        action: async ({ request }) => loginClientAction({ request } as never),
      },
      {
        path: "/app",
        Component: () => <div>App landing</div>,
      },
      {
        path: "/app/library",
        Component: () => <div>Library landing</div>,
      },
    ]);

    render(
      <I18nProvider>
        <Stub initialEntries={["/login?redirect=/app"]} />
      </I18nProvider>,
    );

    expect(screen.getByText("Session target")).toBeInTheDocument();
    expect(
      screen.getByText("After authentication you will be redirected to /app."),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "manual_user_a" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(apiMocks.login).toHaveBeenCalledWith({
        username: "manual_user_a",
        password: "password123",
      });
      expect(sessionMocks.persistSession).toHaveBeenCalled();
    });

    expect(await screen.findByText("App landing")).toBeInTheDocument();
  });

  it("defaults to the library route when no redirect target is provided", async () => {
    const Stub = createRoutesStub([
      {
        path: "/login",
        Component: LoginRoute,
        action: async ({ request }) => loginClientAction({ request } as never),
      },
      {
        path: "/app/library",
        Component: () => <div>Library landing</div>,
      },
    ]);

    render(
      <I18nProvider>
        <Stub initialEntries={["/login"]} />
      </I18nProvider>,
    );

    expect(
      screen.getByText(
        "After authentication you will be redirected to /app/library.",
      ),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "manual_user_a" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Library landing")).toBeInTheDocument();
  });
});
