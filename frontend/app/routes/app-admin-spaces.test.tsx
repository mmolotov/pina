import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "~/lib/i18n";
import AppAdminSpacesRoute, {
  clientAction as spacesClientAction,
  clientLoader as spacesClientLoader,
} from "~/routes/app-admin-spaces";
import type { AdminSpaceDto } from "~/types/api";

const apiMocks = vi.hoisted(() => ({
  deleteAdminSpace: vi.fn(),
  listAdminSpaces: vi.fn(),
  isBackendUnavailableError: vi.fn(() => false),
}));

vi.mock("~/lib/api", () => ({
  ...apiMocks,
  ApiError: class ApiError extends Error {},
}));

function makeSpace(overrides: Partial<AdminSpaceDto> = {}): AdminSpaceDto {
  return {
    id: "s-1",
    name: "Family",
    description: "Shared media",
    visibility: "PRIVATE",
    parentId: null,
    depth: 0,
    creatorId: "u-1",
    creatorName: "Owner One",
    memberCount: 3,
    albumCount: 2,
    photoCount: 42,
    createdAt: "2026-01-02T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

function spacesPage(items: AdminSpaceDto[]) {
  return {
    items,
    page: 0,
    size: 20,
    hasNext: false,
    totalItems: items.length,
    totalPages: 1,
  };
}

function renderRoute() {
  const Stub = createRoutesStub([
    {
      path: "/app/admin/spaces",
      Component: AppAdminSpacesRoute,
      loader: (args) => spacesClientLoader(args as never),
      action: (args) => spacesClientAction(args as never),
    },
  ]);
  return render(
    <I18nProvider>
      <Stub initialEntries={["/app/admin/spaces"]} />
    </I18nProvider>,
  );
}

describe("AppAdminSpacesRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.isBackendUnavailableError.mockReturnValue(false);
    apiMocks.deleteAdminSpace.mockResolvedValue(undefined);
    apiMocks.listAdminSpaces.mockResolvedValue(
      spacesPage([
        makeSpace(),
        makeSpace({
          id: "s-2",
          name: "Trips",
          visibility: "PUBLIC",
          depth: 1,
          parentId: "s-1",
          creatorName: "Creator Two",
        }),
      ]),
    );
  });

  it("renders the Space table", async () => {
    renderRoute();
    expect(await screen.findByText("Family")).toBeInTheDocument();
    expect(screen.getByText("Trips")).toBeInTheDocument();
    expect(screen.getByText("PUBLIC")).toBeInTheDocument();
    expect(screen.getByText("Owner One")).toBeInTheDocument();
  });

  it("force-deletes a Space through the confirm dialog", async () => {
    renderRoute();
    await screen.findByText("Family");

    fireEvent.click(
      screen.getAllByRole("button", { name: "Delete Space" })[0]!,
    );
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Delete Space?")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Delete/ }));

    await waitFor(() =>
      expect(apiMocks.deleteAdminSpace).toHaveBeenCalledWith("s-1"),
    );
  });

  it("shows a table error when the list fails", async () => {
    apiMocks.listAdminSpaces.mockRejectedValue(new Error("boom"));
    renderRoute();
    expect(await screen.findByText("Failed to load data")).toBeInTheDocument();
  });
});
