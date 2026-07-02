import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider, LOCALE_STORAGE_KEY } from "~/lib/i18n";
import AppTrashRoute, {
  clientAction as trashClientAction,
  clientLoader as trashClientLoader,
} from "~/routes/app-trash";
import type { TrashItemDto } from "~/types/api";

const apiMocks = vi.hoisted(() => ({
  getTrash: vi.fn(),
  restoreTrash: vi.fn(),
  purgeTrash: vi.fn(),
  emptyTrash: vi.fn(),
  deletePhoto: vi.fn(),
  deleteAlbum: vi.fn(),
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

function makePhoto(overrides: Partial<TrashItemDto> = {}): TrashItemDto {
  return {
    kind: "PHOTO",
    id: "p1",
    name: "beach.jpg",
    sizeBytes: 512_000,
    deletedAt: "2026-06-20T10:00:00Z",
    purgeAt: "2026-07-20T10:00:00Z",
    daysLeft: 20,
    photoCount: null,
    ...overrides,
  };
}

function makeAlbum(overrides: Partial<TrashItemDto> = {}): TrashItemDto {
  return {
    kind: "ALBUM",
    id: "a1",
    name: "Draft album",
    sizeBytes: 0,
    deletedAt: "2026-06-18T10:00:00Z",
    purgeAt: "2026-07-18T10:00:00Z",
    daysLeft: 18,
    photoCount: 42,
    ...overrides,
  };
}

function trashOf(items: TrashItemDto[]) {
  return {
    items,
    summary: {
      totalItems: items.length,
      totalBytes: items.reduce((sum, item) => sum + item.sizeBytes, 0),
      soonestPurgeDays: items.length
        ? Math.min(...items.map((item) => item.daysLeft))
        : 0,
    },
  };
}

function renderRoute() {
  const Stub = createRoutesStub([
    {
      path: "/app/trash",
      Component: AppTrashRoute,
      action: async ({ request }) => trashClientAction({ request } as never),
      loader: async () => trashClientLoader(),
    },
  ]);
  return render(
    <I18nProvider>
      <Stub initialEntries={["/app/trash"]} />
    </I18nProvider>,
  );
}

describe("AppTrashRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getTrash.mockResolvedValue(trashOf([makePhoto(), makeAlbum()]));
    apiMocks.restoreTrash.mockResolvedValue(undefined);
    apiMocks.purgeTrash.mockResolvedValue(undefined);
    apiMocks.emptyTrash.mockResolvedValue(undefined);
    apiMocks.deletePhoto.mockResolvedValue(undefined);
    apiMocks.deleteAlbum.mockResolvedValue(undefined);
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "en";
  });

  it("renders trashed items with header, info strip and controls", async () => {
    renderRoute();

    expect(await screen.findByText("Deleted items")).toBeInTheDocument();
    expect(screen.getByText("beach.jpg")).toBeInTheDocument();
    expect(screen.getByText("Draft album")).toBeInTheDocument();
    // whole-trash count in the controls bar
    expect(screen.getByText("2 of 2")).toBeInTheDocument();
    // album kind badge with its live photo count
    expect(screen.getByText("42 photos")).toBeInTheDocument();
  });

  it("filters the grid by kind while keeping the summary total", async () => {
    renderRoute();
    await screen.findByText("beach.jpg");

    fireEvent.click(screen.getByRole("tab", { name: "Photos" }));
    expect(screen.getByText("beach.jpg")).toBeInTheDocument();
    expect(screen.queryByText("Draft album")).not.toBeInTheDocument();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Albums" }));
    expect(screen.getByText("Draft album")).toBeInTheDocument();
    expect(screen.queryByText("beach.jpg")).not.toBeInTheDocument();
  });

  it("sorts items by name", async () => {
    apiMocks.getTrash.mockResolvedValue(
      trashOf([
        makePhoto({ id: "p1", name: "zebra.jpg" }),
        makePhoto({ id: "p2", name: "apple.jpg" }),
      ]),
    );
    const { container } = renderRoute();
    await screen.findByText("zebra.jpg");

    fireEvent.change(screen.getByLabelText("Sort"), {
      target: { value: "name" },
    });

    const labels = Array.from(container.querySelectorAll(".tr-tile-label")).map(
      (node) => node.textContent,
    );
    expect(labels).toEqual(["apple.jpg", "zebra.jpg"]);
  });

  it("enters select mode and shows the floating bulk bar", async () => {
    renderRoute();
    await screen.findByText("beach.jpg");

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    const tile = screen.getByRole("button", { name: /Select: beach\.jpg/ });
    fireEvent.click(tile);

    expect(tile).toHaveAttribute("aria-pressed", "true");
    const bulk = screen.getByRole("region", {
      name: "Actions for the selection",
    });
    expect(within(bulk).getByText("Selected: 1")).toBeInTheDocument();
    expect(
      within(bulk).getByRole("button", { name: /Restore selected/ }),
    ).toBeInTheDocument();
  });

  it("restores a single item and offers undo which re-trashes it", async () => {
    renderRoute();
    await screen.findByText("beach.jpg");

    fireEvent.click(
      screen.getByRole("button", { name: /Restore .*beach\.jpg/ }),
    );

    await waitFor(() =>
      expect(apiMocks.restoreTrash).toHaveBeenCalledWith([
        { kind: "PHOTO", id: "p1" },
      ]),
    );
    const toast = await screen.findByRole("status");
    expect(toast).toHaveTextContent("Restored: 1");

    fireEvent.click(within(toast).getByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(apiMocks.deletePhoto).toHaveBeenCalledWith("p1"),
    );
  });

  it("purges a single item through the confirm alertdialog", async () => {
    renderRoute();
    await screen.findByText("beach.jpg");

    fireEvent.click(
      screen.getByRole("button", { name: /Delete .*beach\.jpg.* forever/ }),
    );

    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Delete forever?")).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Delete forever/ }),
    );

    await waitFor(() =>
      expect(apiMocks.purgeTrash).toHaveBeenCalledWith([
        { kind: "PHOTO", id: "p1" },
      ]),
    );
  });

  it("empties the whole trash through the confirm alertdialog", async () => {
    renderRoute();
    await screen.findByText("beach.jpg");

    fireEvent.click(screen.getByRole("button", { name: /Empty trash/ }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Empty trash?")).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Empty trash/ }),
    );

    await waitFor(() => expect(apiMocks.emptyTrash).toHaveBeenCalledTimes(1));
  });

  it("marks the countdown badge as danger within 3 days", async () => {
    apiMocks.getTrash.mockResolvedValue(trashOf([makePhoto({ daysLeft: 2 })]));
    const { container } = renderRoute();
    await screen.findByText("beach.jpg");

    const badge = container.querySelector(".tr-countdown.danger");
    expect(badge).not.toBeNull();
    expect(badge).toHaveTextContent("2 days");
  });

  it("renders the empty state when the trash is empty", async () => {
    apiMocks.getTrash.mockResolvedValue(trashOf([]));
    renderRoute();

    expect(await screen.findByText("Trash is empty")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to library" }),
    ).toBeInTheDocument();
  });

  it("renders the error state when loading fails", async () => {
    apiMocks.getTrash.mockRejectedValue(new Error("boom"));
    renderRoute();

    expect(await screen.findByText("Failed to load trash")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/ })).toBeInTheDocument();
  });

  it("renders Russian copy when the locale is ru", async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "ru");
    renderRoute();

    expect(await screen.findByText("Удалённые элементы")).toBeInTheDocument();
    expect(screen.getByText("42 фото")).toBeInTheDocument();
  });
});
