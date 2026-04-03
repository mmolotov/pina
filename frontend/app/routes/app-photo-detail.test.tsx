import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppPhotoDetailRoute, {
  clientLoader as appPhotoDetailClientLoader,
} from "~/routes/app-photo-detail";

const apiMocks = vi.hoisted(() => ({
  getPhoto: vi.fn(),
  getPhotoBlob: vi.fn(),
  listFavorites: vi.fn(),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  deletePhoto: vi.fn(),
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

describe("AppPhotoDetailRoute", () => {
  beforeEach(() => {
    apiMocks.getPhoto.mockResolvedValue({
      id: "photo-1",
      uploaderId: "user-1",
      originalFilename: "beach.jpg",
      mimeType: "image/jpeg",
      width: 1920,
      height: 1080,
      sizeBytes: 512000,
      personalLibraryId: "library-1",
      exifData: '{"camera":"Phone"}',
      takenAt: "2026-04-02T10:00:00Z",
      createdAt: "2026-04-02T10:05:00Z",
      variants: [
        {
          type: "COMPRESSED",
          format: "jpeg",
          width: 1920,
          height: 1080,
          sizeBytes: 512000,
        },
      ],
    });
    apiMocks.getPhotoBlob.mockResolvedValue(
      new Blob(["test"], { type: "image/jpeg" }),
    );
    apiMocks.listFavorites.mockResolvedValue([]);
    apiMocks.addFavorite.mockResolvedValue(undefined);
    apiMocks.removeFavorite.mockResolvedValue(undefined);
    apiMocks.deletePhoto.mockResolvedValue(undefined);
  });

  it("renders photo metadata and adds favorite", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/library/photos/:photoId",
        Component: AppPhotoDetailRoute,
        loader: async ({ params }) =>
          appPhotoDetailClientLoader({ params } as never),
      },
    ]);

    render(<Stub initialEntries={["/app/library/photos/photo-1"]} />);

    expect(await screen.findByText("beach.jpg")).toBeInTheDocument();
    expect(screen.getByText("Asset details")).toBeInTheDocument();
    expect(screen.getByText('{"camera":"Phone"}')).toBeInTheDocument();
    expect(screen.getByText("Not saved")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open favorites" }),
    ).toHaveAttribute("href", "/app/favorites");

    fireEvent.click(screen.getByRole("button", { name: "Add favorite" }));

    await waitFor(() => {
      expect(apiMocks.addFavorite).toHaveBeenCalledWith("PHOTO", "photo-1");
    });
  });
});
