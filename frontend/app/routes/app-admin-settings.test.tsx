import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppAdminSettingsRoute, {
  clientAction as appAdminSettingsClientAction,
  clientLoader as appAdminSettingsClientLoader,
} from "~/routes/app-admin-settings";

const apiMocks = vi.hoisted(() => ({
  getAdminSettings: vi.fn(),
  updateAdminSettings: vi.fn(),
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

describe("AppAdminSettingsRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    apiMocks.getAdminSettings.mockResolvedValue({
      registrationMode: "INVITE_ONLY",
      compressionFormat: "jpg",
      compressionQuality: 82,
      compressionMaxResolution: 2048,
    });

    apiMocks.updateAdminSettings.mockResolvedValue({
      registrationMode: "OPEN",
      compressionFormat: "png",
      compressionQuality: 90,
      compressionMaxResolution: 4096,
    });
  });

  it("renders settings and updates them with success feedback", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/admin/settings",
        Component: AppAdminSettingsRoute,
        action: async ({ request }) =>
          appAdminSettingsClientAction({ request } as never),
        loader: async ({ request }) =>
          appAdminSettingsClientLoader({ request } as never),
      },
    ]);

    render(<Stub initialEntries={["/app/admin/settings"]} />);

    expect(await screen.findByText("Instance settings")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Registration mode"), {
      target: { value: "OPEN" },
    });
    fireEvent.change(screen.getByLabelText("Compression format"), {
      target: { value: "png" },
    });
    fireEvent.change(screen.getByLabelText("Compression quality"), {
      target: { value: "90" },
    });
    fireEvent.change(screen.getByLabelText("Compression max resolution"), {
      target: { value: "4096" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(apiMocks.updateAdminSettings).toHaveBeenCalledWith({
        registrationMode: "OPEN",
        compressionFormat: "png",
        compressionQuality: 90,
        compressionMaxResolution: 4096,
      });
    });

    expect(await screen.findByText("Settings updated.")).toBeInTheDocument();
  });

  it("shows backend validation feedback when settings update fails", async () => {
    apiMocks.updateAdminSettings.mockRejectedValueOnce(
      new Error("Compression quality must be between 1 and 100"),
    );

    const Stub = createRoutesStub([
      {
        path: "/app/admin/settings",
        Component: AppAdminSettingsRoute,
        action: async ({ request }) =>
          appAdminSettingsClientAction({ request } as never),
        loader: async ({ request }) =>
          appAdminSettingsClientLoader({ request } as never),
      },
    ]);

    render(<Stub initialEntries={["/app/admin/settings"]} />);

    expect(await screen.findByText("Instance settings")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Registration mode"), {
      target: { value: "OPEN" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(apiMocks.updateAdminSettings).toHaveBeenCalledWith({
        registrationMode: "OPEN",
        compressionFormat: "jpg",
        compressionQuality: 82,
        compressionMaxResolution: 2048,
      });
    });

    expect(
      await screen.findByText("Compression quality must be between 1 and 100"),
    ).toBeInTheDocument();
  });

  it("shows an inline load error when settings cannot be fetched", async () => {
    apiMocks.getAdminSettings.mockRejectedValueOnce(
      new Error("Settings load failed"),
    );

    const Stub = createRoutesStub([
      {
        path: "/app/admin/settings",
        Component: AppAdminSettingsRoute,
        action: async ({ request }) =>
          appAdminSettingsClientAction({ request } as never),
        loader: async ({ request }) =>
          appAdminSettingsClientLoader({ request } as never),
      },
    ]);

    render(<Stub initialEntries={["/app/admin/settings"]} />);

    expect(await screen.findByText("Settings load failed")).toBeInTheDocument();
    expect(screen.getByText("Settings are unavailable")).toBeInTheDocument();
  });
});
