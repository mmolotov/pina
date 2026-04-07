import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "~/lib/i18n";
import AppHomeRoute, {
  clientLoader as appHomeClientLoader,
} from "~/routes/app-home";
import AppLibraryRoute, {
  clientLoader as appLibraryClientLoader,
} from "~/routes/app-library";
import LoginRoute from "~/routes/login";
import RegisterRoute from "~/routes/register";

const apiMocks = vi.hoisted(() => ({
  addFavorite: vi.fn(),
  addPhotoToAlbum: vi.fn(),
  createAlbum: vi.fn(),
  deleteAlbum: vi.fn(),
  deletePhoto: vi.fn(),
  getPhotoBlob: vi.fn(),
  getHealth: vi.fn(),
  listAlbums: vi.fn(),
  listAllAlbumPhotos: vi.fn(),
  listAllPhotos: vi.fn(),
  listFavorites: vi.fn(),
  listGeoPhotos: vi.fn(),
  listPhotos: vi.fn(),
  listSpaces: vi.fn(),
  removeFavorite: vi.fn(),
  removePhotoFromAlbum: vi.fn(),
  updateAlbum: vi.fn(),
  uploadPhoto: vi.fn(),
}));

const sessionMocks = vi.hoisted(() => ({
  useSession: vi.fn(),
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

vi.mock("~/lib/session", () => ({
  ...sessionMocks,
}));

describe("frontend accessibility smoke", () => {
  beforeEach(() => {
    sessionMocks.useSession.mockReturnValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 900,
      receivedAt: Date.now(),
      user: {
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
        avatarUrl: null,
        instanceRole: "USER",
        active: true,
      },
    });

    apiMocks.getHealth.mockResolvedValue({
      status: "ok",
      storage: {
        type: "local",
        usedBytes: 1024,
        availableBytes: 2048,
      },
    });
    apiMocks.listPhotos.mockResolvedValue({
      items: [
        {
          id: "photo-1",
          uploaderId: "user-1",
          originalFilename: "beach.jpg",
          mimeType: "image/jpeg",
          width: 1920,
          height: 1080,
          sizeBytes: 512000,
          personalLibraryId: "library-1",
          exifData: null,
          takenAt: null,
          createdAt: "2026-04-02T10:05:00Z",
          variants: [],
        },
      ],
      page: 0,
      size: 6,
      hasNext: false,
      totalItems: 1,
      totalPages: 1,
    });
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
    apiMocks.listAllPhotos.mockResolvedValue([
      {
        id: "photo-1",
        uploaderId: "user-1",
        originalFilename: "beach.jpg",
        mimeType: "image/jpeg",
        width: 1920,
        height: 1080,
        sizeBytes: 512000,
        personalLibraryId: "library-1",
        exifData: null,
        takenAt: null,
        createdAt: "2026-04-02T10:05:00Z",
        variants: [],
      },
    ]);
    apiMocks.listAlbums.mockResolvedValue([]);
    apiMocks.listAllAlbumPhotos.mockResolvedValue([]);
    apiMocks.getPhotoBlob.mockResolvedValue(
      new Blob(["thumb"], { type: "image/jpeg" }),
    );
    apiMocks.listGeoPhotos.mockResolvedValue({
      items: [],
      page: 0,
      size: 100,
      hasNext: false,
      totalItems: 0,
      totalPages: 0,
    });
    apiMocks.listFavorites.mockImplementation(async () => []);
    apiMocks.addFavorite.mockResolvedValue(undefined);
    apiMocks.removeFavorite.mockResolvedValue(undefined);
    apiMocks.uploadPhoto.mockResolvedValue(undefined);
    apiMocks.deletePhoto.mockResolvedValue(undefined);
    apiMocks.createAlbum.mockResolvedValue(undefined);
    apiMocks.updateAlbum.mockResolvedValue(undefined);
    apiMocks.deleteAlbum.mockResolvedValue(undefined);
    apiMocks.addPhotoToAlbum.mockResolvedValue(undefined);
    apiMocks.removePhotoFromAlbum.mockResolvedValue(undefined);
  });

  async function expectNoViolations(container: HTMLElement) {
    expect(
      await axe(container, {
        rules: {
          region: { enabled: false },
        },
      }),
    ).toHaveNoViolations();
  }

  function renderWithI18n(element: ReactElement) {
    return render(<I18nProvider>{element}</I18nProvider>);
  }

  it("keeps the login route free from basic accessibility violations", async () => {
    sessionMocks.useSession.mockReturnValue(null);
    const Stub = createRoutesStub([
      {
        path: "/login",
        Component: LoginRoute,
      },
    ]);

    const { container } = renderWithI18n(<Stub initialEntries={["/login"]} />);

    await expectNoViolations(container);
  });

  it("keeps the register route free from basic accessibility violations", async () => {
    sessionMocks.useSession.mockReturnValue(null);
    const Stub = createRoutesStub([
      {
        path: "/register",
        Component: RegisterRoute,
      },
    ]);

    const { container } = renderWithI18n(
      <Stub initialEntries={["/register"]} />,
    );

    await expectNoViolations(container);
  });

  it("keeps the authenticated overview route free from basic accessibility violations", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app",
        Component: AppHomeRoute,
        loader: async () => appHomeClientLoader(),
      },
    ]);

    const { container, findByText } = renderWithI18n(
      <Stub initialEntries={["/app"]} />,
    );
    await findByText("beach.jpg");

    await expectNoViolations(container);
  });

  it("keeps the library route free from basic accessibility violations", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/library",
        Component: AppLibraryRoute,
        loader: async () => appLibraryClientLoader(),
      },
    ]);

    const { container, findByText } = renderWithI18n(
      <Stub initialEntries={["/app/library"]} />,
    );
    await findByText("beach.jpg");

    await expectNoViolations(container);
  });
});
