import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppSearchRoute, {
  clientLoader as appSearchClientLoader,
} from "~/routes/app-search";

const apiMocks = vi.hoisted(() => ({
  listPhotos: vi.fn(),
  listSpaces: vi.fn(),
  listFavorites: vi.fn(),
}));

vi.mock("~/lib/api", () => ({
  ...apiMocks,
}));

describe("AppSearchRoute", () => {
  beforeEach(() => {
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
      size: 8,
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
    apiMocks.listFavorites.mockResolvedValue([]);
  });

  it("renders the search shell and local preview", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/search",
        Component: AppSearchRoute,
        loader: async () => appSearchClientLoader(),
      },
    ]);

    render(<Stub initialEntries={["/app/search"]} />);

    expect(await screen.findByText("Discovery")).toBeInTheDocument();
    expect(
      await screen.findByText("Search backend not connected yet"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Search backend not connected yet"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Faces (Later)" }),
    ).toBeInTheDocument();
  });

  it("persists query and shows local preview matches", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/search",
        Component: AppSearchRoute,
        loader: async () => appSearchClientLoader(),
      },
    ]);

    render(<Stub initialEntries={["/app/search"]} />);

    expect(await screen.findByText("Discovery")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search query"), {
      target: { value: "beach" },
    });

    expect(await screen.findByText("beach.jpg")).toBeInTheDocument();
    expect(screen.getByText("Photo preview")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Spaces" }));
    fireEvent.change(screen.getByLabelText("Search query"), {
      target: { value: "family" },
    });

    expect(await screen.findByText("Family Space")).toBeInTheDocument();
    expect(screen.getByText("Space preview")).toBeInTheDocument();
  });

  it("supports example chips and clearing the query", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/search",
        Component: AppSearchRoute,
        loader: async () => appSearchClientLoader(),
      },
    ]);

    render(<Stub initialEntries={["/app/search"]} />);

    expect(await screen.findByText("Discovery")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try beach" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Search query")).toHaveValue("beach");
    });
    expect(await screen.findByText("beach.jpg")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear query" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Search query")).toHaveValue("");
    });
    expect(
      screen.getByRole("link", { name: "Open timeline instead" }),
    ).toHaveAttribute("href", "/app/library?view=timeline");
  });
});
