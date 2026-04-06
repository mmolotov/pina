import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppHomeRoute, {
  clientLoader as appHomeClientLoader,
} from "~/routes/app-home";

const apiMocks = vi.hoisted(() => ({
  getHealth: vi.fn(),
  listPhotos: vi.fn(),
  listSpaces: vi.fn(),
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

describe("AppHomeRoute", () => {
  beforeEach(() => {
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

    apiMocks.getHealth.mockResolvedValue({
      status: "ok",
      storage: {
        type: "local",
        usedBytes: 1024,
        availableBytes: 2048,
      },
    });

    apiMocks.listPhotos.mockResolvedValue({
      items: [
        {
          id: "photo-1",
          uploaderId: "user-1",
          originalFilename: "beach.jpg",
          mimeType: "image/jpeg",
          width: 1920,
          height: 1080,
          sizeBytes: 512000,
          personalLibraryId: "library-1",
          exifData: null,
          takenAt: null,
          createdAt: "2026-04-02T10:05:00Z",
          variants: [],
        },
      ],
      page: 0,
      size: 6,
      hasNext: false,
      totalItems: 1,
      totalPages: 1,
    });

    apiMocks.listSpaces.mockResolvedValue([
      {
        id: "space-1",
        name: "Family Space",
        description: "Shared family media",
        avatarUrl: null,
        visibility: "PRIVATE",
        parentId: null,
        depth: 0,
        inheritMembers: true,
        creatorId: "user-1",
        createdAt: "2026-04-02T10:00:00Z",
        updatedAt: "2026-04-02T10:00:00Z",
      },
    ]);
  });

  it("loads dashboard data through the shared async loader", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app",
        Component: AppHomeRoute,
        loader: async () => appHomeClientLoader(),
      },
    ]);

    render(<Stub initialEntries={["/app"]} />);

    expect(await screen.findByText("beach.jpg")).toBeInTheDocument();
    expect(screen.getByText("Family Space")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open timeline" })).toHaveAttribute(
      "href",
      "/app/library?view=timeline",
    );
    expect(screen.getByRole("link", { name: "Search shell" })).toHaveAttribute(
      "href",
      "/app/search",
    );
  });
});
