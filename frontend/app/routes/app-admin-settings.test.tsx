import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "~/lib/i18n";
import AppAdminSettingsRoute, {
  clientAction as settingsClientAction,
  clientLoader as settingsClientLoader,
} from "~/routes/app-admin-settings";

const apiMocks = vi.hoisted(() => ({
  getAdminSettings: vi.fn(),
  updateAdminSettings: vi.fn(),
  isBackendUnavailableError: vi.fn(() => false),
}));

vi.mock("~/lib/api", () => ({
  ...apiMocks,
  ApiError: class ApiError extends Error {},
}));

function renderRoute() {
  const Stub = createRoutesStub([
    {
      path: "/app/admin/settings",
      Component: AppAdminSettingsRoute,
      loader: (args) => settingsClientLoader(args as never),
      action: (args) => settingsClientAction(args as never),
    },
  ]);
  return render(
    <I18nProvider>
      <Stub initialEntries={["/app/admin/settings"]} />
    </I18nProvider>,
  );
}

describe("AppAdminSettingsRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.isBackendUnavailableError.mockReturnValue(false);
    apiMocks.updateAdminSettings.mockResolvedValue({});
    apiMocks.getAdminSettings.mockResolvedValue({
      registrationMode: "INVITE_ONLY",
      compressionFormat: "jpeg",
      compressionQuality: 80,
      compressionMaxResolution: 4096,
    });
  });

  it("renders the settings form", async () => {
    renderRoute();
    expect(await screen.findByText("Invite only")).toBeInTheDocument();
    expect(screen.getByText("All changes saved")).toBeInTheDocument();
  });

  it("saves changed settings", async () => {
    renderRoute();
    await screen.findByText("Invite only");

    fireEvent.click(
      screen.getByRole("button", { name: /Anyone can register/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(apiMocks.updateAdminSettings).toHaveBeenCalledWith({
        registrationMode: "OPEN",
        compressionFormat: "jpeg",
        compressionQuality: 80,
        compressionMaxResolution: 4096,
      }),
    );
  });

  it("blocks saving an out-of-range resolution", async () => {
    renderRoute();
    await screen.findByText("Invite only");

    fireEvent.change(screen.getByLabelText("Max resolution, px"), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Minimum 256 px.")).toBeInTheDocument();
    expect(apiMocks.updateAdminSettings).not.toHaveBeenCalled();
  });
});
