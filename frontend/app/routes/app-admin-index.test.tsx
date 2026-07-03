import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "~/lib/i18n";
import AppAdminIndexRoute, {
  clientLoader as overviewClientLoader,
} from "~/routes/app-admin-index";

const apiMocks = vi.hoisted(() => ({
  getAdminOverview: vi.fn(),
  isBackendUnavailableError: vi.fn(() => false),
}));

vi.mock("~/lib/api", () => ({
  ...apiMocks,
  ApiError: class ApiError extends Error {},
}));

function renderRoute() {
  const Stub = createRoutesStub([
    {
      path: "/app/admin",
      Component: AppAdminIndexRoute,
      loader: (args) => overviewClientLoader(args as never),
    },
  ]);
  return render(
    <I18nProvider>
      <Stub initialEntries={["/app/admin"]} />
    </I18nProvider>,
  );
}

describe("AppAdminIndexRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.isBackendUnavailableError.mockReturnValue(false);
    apiMocks.getAdminOverview.mockResolvedValue({
      totalUsers: 24,
      activeUsers: 20,
      adminUsers: 2,
      totalSpaces: 10,
      activeInvites: 5,
      totalPhotos: 1234,
      totalVariants: 4936,
      totalStorageBytes: 5_000_000_000,
      filesystemUsedBytes: 40_000_000_000,
      filesystemAvailableBytes: 60_000_000_000,
      storageProvider: "local",
      status: "UP",
      version: "1.2.3",
      databaseConnected: true,
      jvmHeapUsedBytes: 200_000_000,
      jvmHeapMaxBytes: 1_000_000_000,
    });
  });

  it("renders the overview KPIs and cards", async () => {
    renderRoute();
    expect(await screen.findByText("Instance overview")).toBeInTheDocument();
    expect(screen.getByText("System state")).toBeInTheDocument();
    expect(screen.getByText("Quick actions")).toBeInTheDocument();
    expect(screen.getByText("5 active links")).toBeInTheDocument();
    expect(screen.getByText("connected")).toBeInTheDocument();
    expect(screen.getByText("1.2.3")).toBeInTheDocument();
  });

  it("shows an error state when the overview fails to load", async () => {
    apiMocks.getAdminOverview.mockRejectedValue(new Error("boom"));
    renderRoute();
    expect(await screen.findByText("Failed to load data")).toBeInTheDocument();
  });
});
