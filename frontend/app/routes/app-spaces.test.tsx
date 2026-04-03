import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppSpacesRoute, {
  clientAction as appSpacesClientAction,
  clientLoader as appSpacesClientLoader,
} from "~/routes/app-spaces";

const apiMocks = vi.hoisted(() => ({
  listSpaces: vi.fn(),
  createSpace: vi.fn(),
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

describe("AppSpacesRoute", () => {
  beforeEach(() => {
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
    apiMocks.createSpace.mockResolvedValue(undefined);
  });

  it("creates a Space and refreshes the list through the shared async loader", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/spaces",
        Component: AppSpacesRoute,
        action: async ({ request }) =>
          appSpacesClientAction({ request } as never),
        loader: async () => appSpacesClientLoader(),
      },
    ]);

    render(<Stub initialEntries={["/app/spaces"]} />);

    expect(await screen.findByText("Family Space")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Roadtrip Space" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Summer photos" },
    });
    fireEvent.change(screen.getByLabelText("Visibility"), {
      target: { value: "PUBLIC" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Space" }));

    await waitFor(() => {
      expect(apiMocks.createSpace).toHaveBeenCalledWith({
        name: "Roadtrip Space",
        description: "Summer photos",
        visibility: "PUBLIC",
      });
    });

    expect(apiMocks.listSpaces.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("filters spaces by text and visibility", async () => {
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
      {
        id: "space-2",
        name: "Club Archive",
        description: "Public race highlights",
        avatarUrl: null,
        visibility: "PUBLIC",
        parentId: null,
        depth: 0,
        inheritMembers: true,
        creatorId: "user-1",
        createdAt: "2026-04-03T10:00:00Z",
        updatedAt: "2026-04-03T10:00:00Z",
      },
    ]);

    const Stub = createRoutesStub([
      {
        path: "/app/spaces",
        Component: AppSpacesRoute,
        action: async ({ request }) =>
          appSpacesClientAction({ request } as never),
        loader: async () => appSpacesClientLoader(),
      },
    ]);

    render(<Stub initialEntries={["/app/spaces"]} />);

    expect(await screen.findByText("Family Space")).toBeInTheDocument();
    expect(screen.getByText("Club Archive")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter spaces"), {
      target: { value: "club" },
    });

    expect(screen.queryByText("Family Space")).not.toBeInTheDocument();
    expect(screen.getByText("Club Archive")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter visibility"), {
      target: { value: "PRIVATE" },
    });

    expect(
      screen.getByText("No Spaces match the current filters"),
    ).toBeInTheDocument();
  });
});
