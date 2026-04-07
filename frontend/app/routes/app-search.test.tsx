import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "~/lib/i18n";
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

  function renderRoute() {
    const Stub = createRoutesStub([
      {
        path: "/app/search",
        Component: AppSearchRoute,
        loader: async () => appSearchClientLoader(),
      },
    ]);

    return render(
      <I18nProvider>
        <Stub initialEntries={["/app/search"]} />
      </I18nProvider>,
    );
  }

  it("renders the search shell and local preview", async () => {
    renderRoute();

    expect(
      await screen.findByText(/discovery|обнаружение/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/backend.*connected|не подключ/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /faces|лица/i }),
    ).toBeInTheDocument();
  });

  it("persists query and shows local preview matches", async () => {
    renderRoute();

    expect(
      await screen.findByText(/discovery|обнаружение/i),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/search query|поисковый запрос/i), {
      target: { value: "beach" },
    });

    expect(await screen.findByText("beach.jpg")).toBeInTheDocument();
    expect(screen.getByText(/photo preview|превью фото/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /spaces/i }));
    fireEvent.change(screen.getByLabelText(/search query|поисковый запрос/i), {
      target: { value: "family" },
    });

    expect(await screen.findByText("Family Space")).toBeInTheDocument();
    expect(screen.getByText(/space preview|превью space/i)).toBeInTheDocument();
  });

  it("supports example chips and clearing the query", async () => {
    renderRoute();

    expect(
      await screen.findByText(/discovery|обнаружение/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /beach/i }));

    await waitFor(() => {
      expect(
        screen.getByLabelText(/search query|поисковый запрос/i),
      ).toHaveValue("beach");
    });
    expect(await screen.findByText("beach.jpg")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /clear|очист/i }));

    await waitFor(() => {
      expect(
        screen.getByLabelText(/search query|поисковый запрос/i),
      ).toHaveValue("");
    });
    expect(
      screen.getByRole("link", { name: /timeline|таймлайн/i }),
    ).toHaveAttribute("href", "/app/library?view=timeline");
  });
});
