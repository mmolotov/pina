import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "~/lib/i18n";
import JoinInviteRoute, {
  clientAction as joinInviteClientAction,
  clientLoader as joinInviteClientLoader,
} from "~/routes/join-invite";

const apiMocks = vi.hoisted(() => ({
  previewInvite: vi.fn(),
  joinInvite: vi.fn(),
}));

const sessionMocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  getSessionSnapshot: vi.fn(),
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

describe("JoinInviteRoute", () => {
  beforeEach(() => {
    apiMocks.previewInvite.mockResolvedValue({
      spaceName: "Family Space",
      spaceDescription: "Shared family media",
      defaultRole: "VIEWER",
    });
    apiMocks.joinInvite.mockResolvedValue(undefined);
    const session = {
      accessToken: "token",
      refreshToken: "refresh",
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
    };
    sessionMocks.useSession.mockReturnValue(session);
    sessionMocks.getSessionSnapshot.mockReturnValue(session);
  });

  it("previews an invite and navigates to Spaces after join", async () => {
    const Stub = createRoutesStub([
      {
        path: "/join/:code",
        Component: JoinInviteRoute,
        action: async ({ params }) =>
          joinInviteClientAction({ params } as never),
        loader: async ({ params }) =>
          joinInviteClientLoader({ params } as never),
      },
      {
        path: "/app/spaces",
        Component: () => <div>Spaces Landing</div>,
      },
    ]);

    render(
      <I18nProvider>
        <Stub initialEntries={["/join/JOIN-123"]} />
      </I18nProvider>,
    );

    expect(await screen.findByText("Family Space")).toBeInTheDocument();
    expect(screen.getByText("Authenticated")).toBeInTheDocument();
    expect(screen.getByText("Join role")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Join Space" }));

    await waitFor(() => {
      expect(apiMocks.joinInvite).toHaveBeenCalledWith("JOIN-123");
    });

    expect(await screen.findByText("Spaces Landing")).toBeInTheDocument();
  });
});
