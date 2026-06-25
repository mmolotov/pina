import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "~/lib/i18n";
import { LibraryMap, type LibraryMapProps } from "~/components/library-map";
import type { GeoPhotoDto } from "~/types/api";

// Deterministic Leaflet stub. project() maps lng/lat to pixels so proximity
// clustering is predictable; the single shared instance lets us assert that the
// glass controls drive the map imperatively.
const leaflet = vi.hoisted(() => {
  const point = (x: number, y: number) => ({
    x,
    y,
    distanceTo: (other: { x: number; y: number }) =>
      Math.hypot(x - other.x, y - other.y),
  });
  const instance = {
    fitBounds: vi.fn(),
    setView: vi.fn(),
    flyTo: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    invalidateSize: vi.fn(),
    removeLayer: vi.fn(),
    remove: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    getZoom: () => 5,
    getBounds: () => ({
      getSouth: () => -85,
      getWest: () => -180,
      getNorth: () => 85,
      getEast: () => 180,
      contains: () => true,
    }),
    project: ([lat, lng]: [number, number]) => point(lng * 1000, lat * 1000),
    latLngToContainerPoint: ([lat, lng]: [number, number]) =>
      point(lng + 400, lat + 300),
  };
  return { instance };
});

vi.mock("leaflet", () => ({
  default: {
    map: vi.fn(() => leaflet.instance),
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    latLngBounds: vi.fn(() => ({})),
  },
}));

function makeGeoPhoto(overrides: Partial<GeoPhotoDto> = {}): GeoPhotoDto {
  return {
    id: "geo-1",
    uploaderId: "user-1",
    originalFilename: "geo.jpg",
    mimeType: "image/jpeg",
    width: 1600,
    height: 900,
    sizeBytes: 256000,
    personalLibraryId: "library-1",
    exifData: null,
    takenAt: "2026-04-03T09:15:00Z",
    latitude: 44.8176,
    longitude: 20.4633,
    createdAt: "2026-04-03T09:15:00Z",
    variants: [],
    albums: [],
    ...overrides,
  };
}

describe("LibraryMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderMap(overrides: Partial<LibraryMapProps> = {}) {
    const props: LibraryMapProps = {
      photos: [makeGeoPhoto()],
      favoritePhotoIds: new Set(),
      loading: false,
      errorMessage: null,
      hasGeoTaggedPhotos: true,
      theme: "light",
      initialBounds: { swLat: 40, swLng: 18, neLat: 48, neLng: 24 },
      onBoundsChange: vi.fn(),
      onOpenPhoto: vi.fn(),
      onRetry: vi.fn(),
      ...overrides,
    };
    render(
      <I18nProvider>
        <LibraryMap {...props} />
      </I18nProvider>,
    );
    return props;
  }

  it("opens a single-photo detail panel and triggers onOpenPhoto", async () => {
    const props = renderMap({
      photos: [makeGeoPhoto({ id: "geo-1", originalFilename: "belgrade.jpg" })],
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Open map marker for belgrade.jpg",
      }),
    );

    expect(screen.getByText(/coordinates/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /open photo detail/i }));
    expect(props.onOpenPhoto).toHaveBeenCalledWith("geo-1");
  });

  it("clusters nearby photos and zooms into the cluster", async () => {
    renderMap({
      photos: [
        makeGeoPhoto({ id: "geo-1", latitude: 44.8176, longitude: 20.4633 }),
        makeGeoPhoto({ id: "geo-2", latitude: 44.8179, longitude: 20.4636 }),
      ],
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: /open map cluster with 2 photos/i,
      }),
    );

    expect(
      screen.getByRole("heading", { name: /cluster of 2 photos/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /zoom into cluster/i }));
    expect(leaflet.instance.fitBounds).toHaveBeenCalled();
  });

  it("filters markers by album", async () => {
    renderMap({
      photos: [
        makeGeoPhoto({
          id: "geo-1",
          originalFilename: "trip.jpg",
          latitude: 44.8,
          longitude: 20.46,
          albums: [{ id: "album-1", name: "Trip" }],
        }),
        makeGeoPhoto({
          id: "geo-2",
          originalFilename: "loose.jpg",
          latitude: -33.87,
          longitude: 151.2,
          albums: [],
        }),
      ],
    });

    await screen.findByRole("button", {
      name: "Open map marker for loose.jpg",
    });

    fireEvent.change(screen.getByLabelText(/album/i), {
      target: { value: "album-1" },
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("button", {
          name: "Open map marker for loose.jpg",
        }),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Open map marker for trip.jpg" }),
    ).toBeInTheDocument();
  });

  it("filters markers by year", async () => {
    renderMap({
      photos: [
        makeGeoPhoto({
          id: "geo-1",
          originalFilename: "old.jpg",
          latitude: 44.8,
          longitude: 20.46,
          takenAt: "2024-05-01T09:15:00Z",
        }),
        makeGeoPhoto({
          id: "geo-2",
          originalFilename: "new.jpg",
          latitude: -33.87,
          longitude: 151.2,
          takenAt: "2026-05-01T09:15:00Z",
        }),
      ],
    });

    await screen.findByRole("button", { name: "Open map marker for old.jpg" });

    fireEvent.change(screen.getByLabelText(/year/i), {
      target: { value: "2024" },
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Open map marker for new.jpg" }),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Open map marker for old.jpg" }),
    ).toBeInTheDocument();
  });

  it("drives the map from the glass zoom and world controls", async () => {
    renderMap();

    fireEvent.click(await screen.findByRole("button", { name: /zoom in/i }));
    fireEvent.click(screen.getByRole("button", { name: /zoom out/i }));
    fireEvent.click(screen.getByRole("button", { name: /whole world|world/i }));

    expect(leaflet.instance.zoomIn).toHaveBeenCalled();
    expect(leaflet.instance.zoomOut).toHaveBeenCalled();
    expect(leaflet.instance.setView).toHaveBeenCalled();
  });

  it("renders the error state and retries", async () => {
    const props = renderMap({ errorMessage: "Boom" });

    expect(await screen.findByText("Boom")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(props.onRetry).toHaveBeenCalled();
  });

  it("shows the no-GPS empty state", async () => {
    renderMap({ photos: [], hasGeoTaggedPhotos: false });

    expect(
      await screen.findByRole("heading", {
        name: /no geo-tagged photos yet/i,
      }),
    ).toBeInTheDocument();
  });
});
