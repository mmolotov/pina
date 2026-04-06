import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppAdminSpacesRoute, {
  clientAction as appAdminSpacesClientAction,
  clientLoader as appAdminSpacesClientLoader,
} from "~/routes/app-admin-spaces";

const apiMocks = vi.hoisted(() => ({
  deleteAdminSpace: vi.fn(),
  getAdminSpace: vi.fn(),
  listAdminSpaces: vi.fn(),
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
  isBackendUnavailableError: vi.fn(() => false),
}));

describe("AppAdminSpacesRoute", () => {
  beforeEach(() => {
    apiMocks.listAdminSpaces.mockResolvedValue({
      items: [
        {
          id: "space-1",
          name: "Family Archive",
          description: "Shared family photos",
          visibility: "PRIVATE",
          parentId: null,
          depth: 0,
          creatorId: "user-1",
          creatorName: "Alice Example",
          memberCount: 4,
          albumCount: 3,
          photoCount: 120,
          createdAt: "2026-04-01T10:00:00Z",
          updatedAt: "2026-04-02T10:00:00Z",
        },
        {
          id: "space-2",
          name: "Event Highlights",
          description: "Public event media",
          visibility: "PUBLIC",
          parentId: "space-1",
          depth: 1,
          creatorId: "user-2",
          creatorName: "Bob Admin",
          memberCount: 9,
          albumCount: 5,
          photoCount: 240,
          createdAt: "2026-04-01T11:00:00Z",
          updatedAt: "2026-04-02T11:00:00Z",
        },
      ],
      page: 0,
      size: 20,
      hasNext: false,
      totalItems: 2,
      totalPages: 1,
    });

    apiMocks.getAdminSpace.mockImplementation(async (spaceId: string) => {
      if (spaceId === "space-2") {
        return {
          id: "space-2",
          name: "Event Highlights",
          description: "Public event media",
          visibility: "PUBLIC",
          parentId: "space-1",
          depth: 1,
          creatorId: "user-2",
          creatorName: "Bob Admin",
          memberCount: 9,
          albumCount: 5,
          photoCount: 240,
          createdAt: "2026-04-01T11:00:00Z",
          updatedAt: "2026-04-02T11:00:00Z",
        };
      }

      return {
        id: "space-1",
        name: "Family Archive",
        description: "Shared family photos",
        visibility: "PRIVATE",
        parentId: null,
        depth: 0,
        creatorId: "user-1",
        creatorName: "Alice Example",
        memberCount: 4,
        albumCount: 3,
        photoCount: 120,
        createdAt: "2026-04-01T10:00:00Z",
        updatedAt: "2026-04-02T10:00:00Z",
      };
    });

    apiMocks.deleteAdminSpace.mockResolvedValue(undefined);
  });

  it("renders a paginated admin Space list and selected Space details", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/admin/spaces",
        Component: AppAdminSpacesRoute,
        action: async ({ request }) =>
          appAdminSpacesClientAction({ request } as never),
        loader: async ({ request }) =>
          appAdminSpacesClientLoader({ request } as never),
      },
    ]);

    render(<Stub initialEntries={["/app/admin/spaces?space=space-2"]} />);

    expect(await screen.findByText("Space oversight")).toBeInTheDocument();
    expect(screen.getByText("Family Archive")).toBeInTheDocument();
    expect(screen.getAllByText("Event Highlights")).toHaveLength(2);
    expect(screen.getByText("Force-delete Space")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open invites for this Space" }),
    ).toHaveAttribute("href", "/app/admin/invites?spaceId=space-2&active=true");
  });

  it("deletes a selected Space and surfaces success feedback", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/admin/spaces",
        Component: AppAdminSpacesRoute,
        action: async ({ request }) =>
          appAdminSpacesClientAction({ request } as never),
        loader: async ({ request }) =>
          appAdminSpacesClientLoader({ request } as never),
      },
    ]);

    render(<Stub initialEntries={["/app/admin/spaces?space=space-1"]} />);

    expect((await screen.findAllByText("Family Archive")).length).toBe(2);

    fireEvent.click(screen.getByRole("button", { name: "Delete Space" }));

    await waitFor(() => {
      expect(apiMocks.deleteAdminSpace).toHaveBeenCalledWith("space-1");
    });

    expect(await screen.findByText("Space deleted.")).toBeInTheDocument();
  });

  it("shows an inline list error when the admin Space list request fails", async () => {
    apiMocks.listAdminSpaces.mockRejectedValueOnce(
      new Error("Admin Space list failed"),
    );

    const Stub = createRoutesStub([
      {
        path: "/app/admin/spaces",
        Component: AppAdminSpacesRoute,
        action: async ({ request }) =>
          appAdminSpacesClientAction({ request } as never),
        loader: async ({ request }) =>
          appAdminSpacesClientLoader({ request } as never),
      },
    ]);

    render(<Stub initialEntries={["/app/admin/spaces"]} />);

    expect(
      await screen.findByText("Admin Space list failed"),
    ).toBeInTheDocument();
  });
});
