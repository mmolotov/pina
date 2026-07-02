import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "~/lib/i18n";
import AppAdminHealthRoute, {
  clientLoader as healthClientLoader,
} from "~/routes/app-admin-health";

const apiMocks = vi.hoisted(() => ({
  getAdminHealth: vi.fn(),
  isBackendUnavailableError: vi.fn(() => false),
}));

vi.mock("~/lib/api", () => ({
  ...apiMocks,
  ApiError: class ApiError extends Error {},
}));

function renderRoute() {
  const Stub = createRoutesStub([
    {
      path: "/app/admin/health",
      Component: AppAdminHealthRoute,
      loader: (args) => healthClientLoader(args as never),
    },
  ]);
  return render(
    <I18nProvider>
      <Stub initialEntries={["/app/admin/health"]} />
    </I18nProvider>,
  );
}

describe("AppAdminHealthRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.isBackendUnavailableError.mockReturnValue(false);
    apiMocks.getAdminHealth.mockResolvedValue({
      status: "UP",
      version: "1.2.3",
      database: { connected: true, version: "PostgreSQL 16.2" },
      storage: {
        provider: "local",
        usedBytes: 500_000_000,
        availableBytes: 500_000_000,
      },
      jvm: {
        heapUsedBytes: 200_000_000,
        heapMaxBytes: 1_000_000_000,
        nonHeapUsedBytes: 100_000_000,
        availableProcessors: 8,
      },
    });
  });

  it("renders the health cards", async () => {
    renderRoute();
    expect(await screen.findByText("UP")).toBeInTheDocument();
    expect(screen.getByText("connected")).toBeInTheDocument();
    expect(screen.getByText("local")).toBeInTheDocument();
    expect(screen.getByText("PG 16.2")).toBeInTheDocument();
  });

  it("shows an error state when health fails to load", async () => {
    apiMocks.getAdminHealth.mockRejectedValue(new Error("boom"));
    renderRoute();
    expect(await screen.findByText("Failed to load data")).toBeInTheDocument();
  });
});
