import type { PhotoDto, PhotoGeoBounds } from "~/types/api";

export interface GeoMarkerPosition {
  left: number;
  top: number;
}

export interface GeoCluster {
  id: string;
  photos: PhotoDto[];
  position: GeoMarkerPosition;
  bounds: PhotoGeoBounds;
}

export const DEFAULT_GEO_VIEWPORT: PhotoGeoBounds = {
  swLat: -55,
  swLng: -180,
  neLat: 75,
  neLng: 180,
};

const MIN_LATITUDE = -90;
const MAX_LATITUDE = 90;
const MIN_LONGITUDE = -180;
const MAX_LONGITUDE = 180;
const MIN_NORMALIZED_LAT_SPAN = 0.01;
const MIN_NORMALIZED_LNG_SPAN = 0.01;
const MIN_LAT_SPAN = 5;
const MIN_LNG_SPAN = 10;

export function clampLatitude(value: number) {
  return Math.min(MAX_LATITUDE, Math.max(MIN_LATITUDE, value));
}

export function clampLongitude(value: number) {
  return Math.min(MAX_LONGITUDE, Math.max(MIN_LONGITUDE, value));
}

export function normalizeGeoViewport(bounds: PhotoGeoBounds): PhotoGeoBounds {
  const swLat = clampLatitude(Math.min(bounds.swLat, bounds.neLat));
  const neLat = clampLatitude(Math.max(bounds.swLat, bounds.neLat));
  const swLng = clampLongitude(Math.min(bounds.swLng, bounds.neLng));
  const neLng = clampLongitude(Math.max(bounds.swLng, bounds.neLng));
  const latSpan = Math.max(MIN_NORMALIZED_LAT_SPAN, neLat - swLat);
  const lngSpan = Math.max(MIN_NORMALIZED_LNG_SPAN, neLng - swLng);

  return {
    swLat: clampLatitude(swLat),
    swLng: clampLongitude(swLng),
    neLat: clampLatitude(swLat + latSpan),
    neLng: clampLongitude(swLng + lngSpan),
  };
}

export function parseGeoViewportFromSearchParams(
  searchParams: URLSearchParams,
): PhotoGeoBounds {
  const swLat = parseViewportValue(searchParams.get("swLat"));
  const swLng = parseViewportValue(searchParams.get("swLng"));
  const neLat = parseViewportValue(searchParams.get("neLat"));
  const neLng = parseViewportValue(searchParams.get("neLng"));

  if (swLat != null && swLng != null && neLat != null && neLng != null) {
    return normalizeGeoViewport({
      swLat,
      swLng,
      neLat,
      neLng,
    });
  }

  return DEFAULT_GEO_VIEWPORT;
}

export function applyGeoViewportToSearchParams(
  searchParams: URLSearchParams,
  bounds: PhotoGeoBounds,
) {
  const normalized = normalizeGeoViewport(bounds);
  const nextParams = new URLSearchParams(searchParams);
  nextParams.set("swLat", normalized.swLat.toFixed(4));
  nextParams.set("swLng", normalized.swLng.toFixed(4));
  nextParams.set("neLat", normalized.neLat.toFixed(4));
  nextParams.set("neLng", normalized.neLng.toFixed(4));
  return nextParams;
}

export function panGeoViewport(
  bounds: PhotoGeoBounds,
  direction: "north" | "south" | "east" | "west",
) {
  const latSpan = bounds.neLat - bounds.swLat;
  const lngSpan = bounds.neLng - bounds.swLng;
  const latStep = latSpan * 0.25;
  const lngStep = lngSpan * 0.25;

  switch (direction) {
    case "north":
      return normalizeGeoViewport({
        swLat: clampLatitude(bounds.swLat + latStep),
        swLng: bounds.swLng,
        neLat: clampLatitude(bounds.neLat + latStep),
        neLng: bounds.neLng,
      });
    case "south":
      return normalizeGeoViewport({
        swLat: clampLatitude(bounds.swLat - latStep),
        swLng: bounds.swLng,
        neLat: clampLatitude(bounds.neLat - latStep),
        neLng: bounds.neLng,
      });
    case "east":
      return normalizeGeoViewport({
        swLat: bounds.swLat,
        swLng: clampLongitude(bounds.swLng + lngStep),
        neLat: bounds.neLat,
        neLng: clampLongitude(bounds.neLng + lngStep),
      });
    case "west":
      return normalizeGeoViewport({
        swLat: bounds.swLat,
        swLng: clampLongitude(bounds.swLng - lngStep),
        neLat: bounds.neLat,
        neLng: clampLongitude(bounds.neLng - lngStep),
      });
  }
}

export function zoomGeoViewport(
  bounds: PhotoGeoBounds,
  direction: "in" | "out",
) {
  const latCenter = (bounds.swLat + bounds.neLat) / 2;
  const lngCenter = (bounds.swLng + bounds.neLng) / 2;
  const factor = direction === "in" ? 0.65 : 1.4;
  const nextLatSpan = Math.max(
    MIN_LAT_SPAN,
    (bounds.neLat - bounds.swLat) * factor,
  );
  const nextLngSpan = Math.max(
    MIN_LNG_SPAN,
    (bounds.neLng - bounds.swLng) * factor,
  );

  return normalizeGeoViewport({
    swLat: clampLatitude(latCenter - nextLatSpan / 2),
    swLng: clampLongitude(lngCenter - nextLngSpan / 2),
    neLat: clampLatitude(latCenter + nextLatSpan / 2),
    neLng: clampLongitude(lngCenter + nextLngSpan / 2),
  });
}

export function markerPositionForPhoto(
  photo: Pick<PhotoDto, "latitude" | "longitude">,
  bounds: PhotoGeoBounds,
): GeoMarkerPosition | null {
  if (photo.latitude == null || photo.longitude == null) {
    return null;
  }

  const latSpan = bounds.neLat - bounds.swLat;
  const lngSpan = bounds.neLng - bounds.swLng;
  if (latSpan <= 0 || lngSpan <= 0) {
    return null;
  }

  const x = ((photo.longitude - bounds.swLng) / lngSpan) * 100;
  const y = ((bounds.neLat - photo.latitude) / latSpan) * 100;

  return {
    left: Math.min(100, Math.max(0, x)),
    top: Math.min(100, Math.max(0, y)),
  };
}

export function buildGeoClusters(
  photos: PhotoDto[],
  bounds: PhotoGeoBounds,
  gridPercent = 12,
) {
  const buckets = new Map<string, PhotoDto[]>();

  for (const photo of photos) {
    const position = markerPositionForPhoto(photo, bounds);
    if (!position) {
      continue;
    }

    const column = Math.floor(position.left / gridPercent);
    const row = Math.floor(position.top / gridPercent);
    const key = `${column}:${row}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(photo);
    } else {
      buckets.set(key, [photo]);
    }
  }

  return Array.from(buckets.entries()).map(([key, bucketPhotos]) => {
    const positionedPhotos = bucketPhotos
      .map((photo) => ({
        photo,
        position: markerPositionForPhoto(photo, bounds),
      }))
      .filter(
        (entry): entry is { photo: PhotoDto; position: GeoMarkerPosition } =>
          entry.position != null,
      );

    const averageLeft =
      positionedPhotos.reduce((sum, entry) => sum + entry.position.left, 0) /
      positionedPhotos.length;
    const averageTop =
      positionedPhotos.reduce((sum, entry) => sum + entry.position.top, 0) /
      positionedPhotos.length;

    return {
      id: `cluster:${key}`,
      photos: bucketPhotos,
      position: {
        left: averageLeft,
        top: averageTop,
      },
      bounds: boundsForPhotos(bucketPhotos),
    } satisfies GeoCluster;
  });
}

export function zoomToClusterBounds(clusterBounds: PhotoGeoBounds) {
  const latSpan = Math.max(
    MIN_LAT_SPAN,
    clusterBounds.neLat - clusterBounds.swLat,
  );
  const lngSpan = Math.max(
    MIN_LNG_SPAN,
    clusterBounds.neLng - clusterBounds.swLng,
  );
  const latPadding = latSpan * 0.35;
  const lngPadding = lngSpan * 0.35;

  return normalizeGeoViewport({
    swLat: clusterBounds.swLat - latPadding,
    swLng: clusterBounds.swLng - lngPadding,
    neLat: clusterBounds.neLat + latPadding,
    neLng: clusterBounds.neLng + lngPadding,
  });
}

function boundsForPhotos(photos: PhotoDto[]): PhotoGeoBounds {
  const latitudes = photos
    .map((photo) => photo.latitude)
    .filter((value): value is number => value != null);
  const longitudes = photos
    .map((photo) => photo.longitude)
    .filter((value): value is number => value != null);

  if (latitudes.length === 0 || longitudes.length === 0) {
    return DEFAULT_GEO_VIEWPORT;
  }

  return normalizeGeoViewport({
    swLat: Math.min(...latitudes),
    swLng: Math.min(...longitudes),
    neLat: Math.max(...latitudes),
    neLng: Math.max(...longitudes),
  });
}

function parseViewportValue(value: string | null) {
  if (value == null || value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
