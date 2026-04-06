import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppAdminStorageRoute, {
  clientLoader as appAdminStorageClientLoader,
} from "~/routes/app-admin-storage";

const apiMocks = vi.hoisted(() => ({
  getAdminStorageSummary: vi.fn(),
  listAdminStorageSpaces: vi.fn(),
  listAdminStorageUsers: vi.fn(),
}));

vi.mock("~/lib/api", () => ({
  ...apiMocks,
  isBackendUnavailableError: vi.fn(() => false),
}));

describe("AppAdminStorageRoute", () => {
  beforeEach(() => {
    apiMocks.getAdminStorageSummary.mockResolvedValue({
      storageProvider: "filesystem",
      totalPhotos: 42,
      totalVariants: 84,
      totalStorageBytes: 1024 * 1024,
      filesystemUsedBytes: 2 * 1024 * 1024,
      filesystemAvailableBytes: 8 * 1024 * 1024,
    });

    apiMocks.listAdminStorageUsers.mockResolvedValue({
      items: [
        {
          userId: "user-1",
          userName: "Alice Example",
          photoCount: 20,
          variantCount: 40,
          storageBytesUsed: 4096,
        },
      ],
      page: 0,
      size: 10,
      hasNext: false,
      totalItems: 1,
      totalPages: 1,
    });

    apiMocks.listAdminStorageSpaces.mockResolvedValue({
      items: [
        {
          spaceId: "space-1",
          spaceName: "Family Archive",
          albumCount: 3,
          photoCount: 12,
        },
      ],
      page: 0,
      size: 10,
      hasNext: false,
      totalItems: 1,
      totalPages: 1,
    });
  });

  it("renders storage summary and breakdown panels", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/admin/storage",
        Component: AppAdminStorageRoute,
        loader: async ({ request }) =>
          appAdminStorageClientLoader({ request } as never),
      },
    ]);

    render(<Stub initialEntries={["/app/admin/storage"]} />);

    expect(await screen.findByText("Storage operations")).toBeInTheDocument();
    expect(screen.getByText("filesystem")).toBeInTheDocument();
    expect(screen.getByText("Alice Example")).toBeInTheDocument();
    expect(screen.getByText("Family Archive")).toBeInTheDocument();
  });

  it("shows an empty-state hint when no media is stored yet", async () => {
    apiMocks.getAdminStorageSummary.mockResolvedValueOnce({
      storageProvider: "filesystem",
      totalPhotos: 0,
      totalVariants: 0,
      totalStorageBytes: 0,
      filesystemUsedBytes: 0,
      filesystemAvailableBytes: 8 * 1024 * 1024,
    });
    apiMocks.listAdminStorageUsers.mockResolvedValueOnce({
      items: [],
      page: 0,
      size: 10,
      hasNext: false,
      totalItems: 0,
      totalPages: 0,
    });
    apiMocks.listAdminStorageSpaces.mockResolvedValueOnce({
      items: [],
      page: 0,
      size: 10,
      hasNext: false,
      totalItems: 0,
      totalPages: 0,
    });

    const Stub = createRoutesStub([
      {
        path: "/app/admin/storage",
        Component: AppAdminStorageRoute,
        loader: async ({ request }) =>
          appAdminStorageClientLoader({ request } as never),
      },
    ]);

    render(<Stub initialEntries={["/app/admin/storage"]} />);

    expect(await screen.findByText("No stored media yet")).toBeInTheDocument();
  });

  it("shows inline storage errors without breaking the route", async () => {
    apiMocks.getAdminStorageSummary.mockRejectedValueOnce(
      new Error("Storage summary failed"),
    );

    const Stub = createRoutesStub([
      {
        path: "/app/admin/storage",
        Component: AppAdminStorageRoute,
        loader: async ({ request }) =>
          appAdminStorageClientLoader({ request } as never),
      },
    ]);

    render(<Stub initialEntries={["/app/admin/storage"]} />);

    expect(
      await screen.findByText("Storage summary failed"),
    ).toBeInTheDocument();
    expect(screen.getByText("Alice Example")).toBeInTheDocument();
  });
});
