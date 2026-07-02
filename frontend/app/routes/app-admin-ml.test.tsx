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
import AppAdminMlRoute, {
  clientAction as mlClientAction,
  clientLoader as mlClientLoader,
} from "~/routes/app-admin-ml";
import type { AdminMlDto, AdminMlJobDto } from "~/types/api";

const apiMocks = vi.hoisted(() => ({
  getAdminMl: vi.fn(),
  listAdminMlJobs: vi.fn(),
  retryAdminMlJob: vi.fn(),
  reanalyzeAdminMlJob: vi.fn(),
  retryAllFailedAdminMl: vi.fn(),
  isBackendUnavailableError: vi.fn(() => false),
}));

vi.mock("~/lib/api", () => ({
  ...apiMocks,
  ApiError: class ApiError extends Error {},
}));

function mlSnapshot(enabled = true): AdminMlDto {
  return {
    status: {
      enabled,
      reachable: enabled,
      serviceVersion: "0.9.4",
      activeProfile: "default",
      ready: enabled,
      models: [
        {
          step: "image_embedding",
          modelId: "clip-vit-b32",
          version: "1.0",
          runtime: "onnx",
          available: true,
          license: null,
        },
        {
          step: "face_embedding",
          modelId: "arcface-r100",
          version: "0.7",
          runtime: "onnx",
          available: false,
          license: null,
        },
      ],
      profile: null,
      inferenceSettings: [],
    },
    counts: { pending: 5, completed: 100, failed: 2 },
  };
}

function jobsPage(items: AdminMlJobDto[]) {
  return {
    items,
    page: 0,
    size: 8,
    hasNext: false,
    totalItems: items.length,
    totalPages: 1,
  };
}

const failedJob: AdminMlJobDto = {
  photoId: "ph-1",
  photoName: "IMG_1.jpg",
  status: "FAILED",
  attempts: 2,
  nextAttemptAt: "2026-06-24T12:00:00Z",
  lastError: "InferenceError: boom",
  createdAt: "2026-06-24T10:00:00Z",
};

function renderRoute() {
  const Stub = createRoutesStub([
    {
      path: "/app/admin/ml",
      Component: AppAdminMlRoute,
      loader: (args) => mlClientLoader(args as never),
      action: (args) => mlClientAction(args as never),
    },
  ]);
  return render(
    <I18nProvider>
      <Stub initialEntries={["/app/admin/ml"]} />
    </I18nProvider>,
  );
}

describe("AppAdminMlRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.isBackendUnavailableError.mockReturnValue(false);
    apiMocks.retryAdminMlJob.mockResolvedValue(undefined);
    apiMocks.retryAllFailedAdminMl.mockResolvedValue({ requeued: 2 });
    apiMocks.getAdminMl.mockResolvedValue(mlSnapshot());
    apiMocks.listAdminMlJobs.mockResolvedValue(jobsPage([failedJob]));
  });

  it("renders the service status, models, and the queue", async () => {
    renderRoute();
    expect(await screen.findByText("Analysis service")).toBeInTheDocument();
    expect(screen.getByText("clip-vit-b32")).toBeInTheDocument();
    expect(screen.getByText("Missing")).toBeInTheDocument();
    expect(screen.getByText("IMG_1.jpg")).toBeInTheDocument();
  });

  it("retries a single failed job", async () => {
    renderRoute();
    await screen.findByText("IMG_1.jpg");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(apiMocks.retryAdminMlJob).toHaveBeenCalledWith("ph-1"),
    );
  });

  it("retries all failed jobs through the confirm dialog", async () => {
    renderRoute();
    await screen.findByText("IMG_1.jpg");

    fireEvent.click(screen.getByRole("button", { name: /Retry all failed/ }));
    const dialog = screen.getByRole("alertdialog");
    expect(
      within(dialog).getByText("Retry all failed jobs?"),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Retry all/ }));

    await waitFor(() =>
      expect(apiMocks.retryAllFailedAdminMl).toHaveBeenCalled(),
    );
  });

  it("shows the disabled banner when ML is off", async () => {
    apiMocks.getAdminMl.mockResolvedValue(mlSnapshot(false));
    renderRoute();
    expect(
      await screen.findByText("Analysis service disabled."),
    ).toBeInTheDocument();
  });
});
