import { fireEvent, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "~/lib/i18n";
import AppAdminStorageRoute, {
  clientLoader as storageClientLoader,
} from "~/routes/app-admin-storage";

const apiMocks = vi.hoisted(() => ({
  getAdminStorageSummary: vi.fn(),
  listAdminStorageSpaces: vi.fn(),
  listAdminStorageUsers: vi.fn(),
  isBackendUnavailableError: vi.fn(() => false),
}));

vi.mock("~/lib/api", () => ({
  ...apiMocks,
  ApiError: class ApiError extends Error {},
}));

function page<T>(items: T[]) {
  return {
    items,
    page: 0,
    size: 10,
    hasNext: false,
    totalItems: items.length,
    totalPages: 1,
  };
}

function renderRoute() {
  const Stub = createRoutesStub([
    {
      path: "/app/admin/storage",
      Component: AppAdminStorageRoute,
      loader: (args) => storageClientLoader(args as never),
    },
  ]);
  return render(
    <I18nProvider>
      <Stub initialEntries={["/app/admin/storage"]} />
    </I18nProvider>,
  );
}

describe("AppAdminStorageRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.isBackendUnavailableError.mockReturnValue(false);
    apiMocks.getAdminStorageSummary.mockResolvedValue({
      storageProvider: "local",
      totalPhotos: 100,
      totalVariants: 400,
      totalStorageBytes: 1_000_000_000,
      filesystemUsedBytes: 9_000_000_000,
      filesystemAvailableBytes: 1_000_000_000,
    });
    apiMocks.listAdminStorageUsers.mockResolvedValue(
      page([
        {
          userId: "u-1",
          userName: "Bob Ivanov",
          photoCount: 50,
          variantCount: 200,
          storageBytesUsed: 500_000_000,
        },
      ]),
    );
    apiMocks.listAdminStorageSpaces.mockResolvedValue(
      page([
        {
          spaceId: "s-1",
          spaceName: "Family Space",
          albumCount: 2,
          photoCount: 40,
        },
      ]),
    );
  });

  it("renders the storage summary and a disk-full warning", async () => {
    renderRoute();
    expect(await screen.findByText("local")).toBeInTheDocument();
    expect(screen.getByText(/Disk is 90% full/)).toBeInTheDocument();
    expect(screen.getByText("Bob Ivanov")).toBeInTheDocument();
  });

  it("switches to the Space breakdown tab", async () => {
    renderRoute();
    await screen.findByText("Bob Ivanov");

    fireEvent.click(screen.getByRole("tab", { name: "By Space" }));
    expect(screen.getByText("Family Space")).toBeInTheDocument();
  });
});
