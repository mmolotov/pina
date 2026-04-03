import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RegisterRoute, {
  clientAction as registerClientAction,
} from "~/routes/register";

const apiMocks = vi.hoisted(() => ({
  register: vi.fn(),
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

describe("RegisterRoute", () => {
  beforeEach(() => {
    sessionMocks.useSession.mockReturnValue(null);
    apiMocks.register.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 900,
      user: {
        id: "user-2",
        name: "New User",
        email: null,
        avatarUrl: null,
      },
    });
  });

  it("creates a local account through the route action and persists the session", async () => {
    const Stub = createRoutesStub([
      {
        path: "/register",
        Component: RegisterRoute,
        action: async ({ request }) =>
          registerClientAction({ request } as never),
      },
      {
        path: "/app",
        Component: () => <div>App landing</div>,
      },
    ]);

    render(<Stub initialEntries={["/register"]} />);

    expect(screen.getByText("What happens next")).toBeInTheDocument();
    expect(
      screen.getByText("You are signed in and redirected to /app."),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Manual User A" },
    });
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "manual_user_a" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(apiMocks.register).toHaveBeenCalledWith({
        name: "Manual User A",
        username: "manual_user_a",
        password: "password123",
      });
      expect(sessionMocks.persistSession).toHaveBeenCalled();
    });

    expect(await screen.findByText("App landing")).toBeInTheDocument();
  });
});
