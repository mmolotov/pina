import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppAdminHealthRoute, {
  clientLoader as appAdminHealthClientLoader,
} from "~/routes/app-admin-health";

const apiMocks = vi.hoisted(() => ({
  getAdminHealth: vi.fn(),
}));

vi.mock("~/lib/api", () => ({
  ...apiMocks,
  isBackendUnavailableError: vi.fn(() => false),
}));

describe("AppAdminHealthRoute", () => {
  beforeEach(() => {
    apiMocks.getAdminHealth.mockResolvedValue({
      status: "UP",
      version: "1.2.3",
      database: {
        connected: false,
        version: null,
      },
      storage: {
        provider: "filesystem",
        usedBytes: 4096,
        availableBytes: 0,
      },
      jvm: {
        heapUsedBytes: 8192,
        heapMaxBytes: 65536,
        nonHeapUsedBytes: 2048,
        availableProcessors: 8,
      },
    });
  });

  it("renders degraded health information without breaking the admin route", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/admin/health",
        Component: AppAdminHealthRoute,
        loader: async ({ request }) =>
          appAdminHealthClientLoader({ request } as never),
      },
    ]);

    render(<Stub initialEntries={["/app/admin/health"]} />);

    expect(await screen.findByText("System health")).toBeInTheDocument();
    expect(screen.getByText("Degraded operational state")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getAllByText("filesystem")).toHaveLength(2);
  });

  it("shows an inline error when the health request fails", async () => {
    apiMocks.getAdminHealth.mockRejectedValueOnce(
      new Error("Health load failed"),
    );

    const Stub = createRoutesStub([
      {
        path: "/app/admin/health",
        Component: AppAdminHealthRoute,
        loader: async ({ request }) =>
          appAdminHealthClientLoader({ request } as never),
      },
    ]);

    render(<Stub initialEntries={["/app/admin/health"]} />);

    expect(await screen.findByText("Health load failed")).toBeInTheDocument();
    expect(screen.getByText("Health data is unavailable")).toBeInTheDocument();
  });
});
