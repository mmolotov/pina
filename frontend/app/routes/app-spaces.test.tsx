import { fireEvent, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "~/lib/i18n";
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

  function renderRoute() {
    const Stub = createRoutesStub([
      {
        path: "/app/spaces",
        Component: AppSpacesRoute,
        action: async ({ request }) =>
          appSpacesClientAction({ request } as never),
        loader: async () => appSpacesClientLoader(),
      },
    ]);

    return render(
      <I18nProvider>
        <Stub initialEntries={["/app/spaces"]} />
      </I18nProvider>,
    );
  }

  it("creates a Space through the route action", async () => {
    const formData = new FormData();
    formData.set("name", "Roadtrip Space");
    formData.set("description", "Summer photos");
    formData.set("visibility", "PUBLIC");

    const result = await appSpacesClientAction({
      request: new Request("http://localhost/app/spaces", {
        method: "POST",
        body: formData,
      }),
    } as never);

    expect(result).toEqual({ ok: true });
    expect(apiMocks.createSpace).toHaveBeenCalledWith({
      name: "Roadtrip Space",
      description: "Summer photos",
      visibility: "PUBLIC",
    });
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

    renderRoute();

    expect(await screen.findByText("Family Space")).toBeInTheDocument();
    expect(screen.getByText("Club Archive")).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link")
        .find(
          (link) => link.getAttribute("href") === "/app/library?view=albums",
        ),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/filter spaces|фильтр spaces/i), {
      target: { value: "club" },
    });

    expect(screen.queryByText("Family Space")).not.toBeInTheDocument();
    expect(screen.getByText("Club Archive")).toBeInTheDocument();

    fireEvent.change(
      screen.getByLabelText(/filter visibility|фильтр видимости/i),
      {
        target: { value: "PRIVATE" },
      },
    );

    expect(screen.getByText(/no spaces match|нет spaces/i)).toBeInTheDocument();
  });
});
