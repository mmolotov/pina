import { describe, expect, it } from "vitest";
import {
  buildGeoClusters,
  DEFAULT_GEO_VIEWPORT,
  parseGeoViewportFromSearchParams,
  zoomToClusterBounds,
} from "~/lib/geo";
import type { PhotoDto } from "~/types/api";

function createPhoto(
  id: string,
  latitude: number,
  longitude: number,
): PhotoDto {
  return {
    id,
    uploaderId: "user-1",
    originalFilename: `${id}.jpg`,
    mimeType: "image/jpeg",
    width: 1000,
    height: 800,
    sizeBytes: 2048,
    personalLibraryId: "library-1",
    exifData: null,
    takenAt: null,
    latitude,
    longitude,
    createdAt: "2026-04-03T10:00:00Z",
    variants: [],
  };
}

describe("geo helpers", () => {
  it("falls back to the default viewport when URL bounds are missing", () => {
    const bounds = parseGeoViewportFromSearchParams(new URLSearchParams());

    expect(bounds).toEqual(DEFAULT_GEO_VIEWPORT);
  });

  it("clusters nearby photos into a single render point", () => {
    const clusters = buildGeoClusters(
      [
        createPhoto("photo-1", 44.8176, 20.4633),
        createPhoto("photo-2", 44.8181, 20.4639),
        createPhoto("photo-3", 46.0, 22.0),
      ],
      {
        swLat: 40,
        swLng: 18,
        neLat: 48,
        neLng: 24,
      },
      18,
    );

    expect(clusters).toHaveLength(2);
    expect(clusters[0]?.photos.length).toBeGreaterThan(1);
    expect(clusters[1]?.photos).toHaveLength(1);
  });

  it("expands cluster bounds when zooming into a cluster", () => {
    const zoomed = zoomToClusterBounds({
      swLat: 44.81,
      swLng: 20.46,
      neLat: 44.82,
      neLng: 20.47,
    });

    expect(zoomed.swLat).toBeLessThan(44.81);
    expect(zoomed.neLat).toBeGreaterThan(44.82);
    expect(zoomed.swLng).toBeLessThan(20.46);
    expect(zoomed.neLng).toBeGreaterThan(20.47);
  });
});
