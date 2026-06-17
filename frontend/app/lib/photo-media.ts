import type { PhotoDto } from "~/types/api";

export type MediaKind = "photo" | "video" | "raw";

/**
 * Context passed from the library feed (parent route) down to the single-photo
 * lightbox overlay (nested route) so ←/→ paging can resolve neighbours without
 * refetching the feed.
 */
export interface PhotoOverlayContext {
  orderedPhotoIds: string[];
}

const RAW_EXTENSIONS = [
  ".dng",
  ".cr2",
  ".cr3",
  ".nef",
  ".arw",
  ".raf",
  ".rw2",
  ".orf",
  ".srw",
  ".pef",
  ".raw",
];

/**
 * Best-effort media kind for the feed type filter / badges. The backend has no
 * dedicated type field, so we derive it from the MIME type and filename.
 * Screenshots are not reliably detectable, so they fall back to "photo".
 */
export function getPhotoMediaKind(photo: PhotoDto): MediaKind {
  const mime = photo.mimeType.toLowerCase();
  if (mime.startsWith("video/")) {
    return "video";
  }
  const name = photo.originalFilename.toLowerCase();
  if (
    mime.includes("raw") ||
    RAW_EXTENSIONS.some((ext) => name.endsWith(ext))
  ) {
    return "raw";
  }
  return "photo";
}

/** Aspect ratio (w/h) with a sensible landscape fallback when EXIF lacks dimensions. */
export function getPhotoRatio(photo: PhotoDto): number {
  if (photo.width && photo.height && photo.height > 0) {
    return photo.width / photo.height;
  }
  return 3 / 2;
}

/**
 * Parse `exifData` (an opaque string from the backend) into label/value pairs
 * when it is a flat JSON object. Returns null when it is not JSON so callers can
 * fall back to rendering the raw string.
 */
export function parseExifEntries(
  exifData: string | null,
): [string, string][] | null {
  if (!exifData) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(exifData);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed as Record<string, unknown>)
        .filter(([, value]) => value != null && typeof value !== "object")
        .map(([key, value]) => [key, String(value)] as [string, string]);
      return entries.length > 0 ? entries : null;
    }
  } catch {
    // Not JSON — caller renders the raw string instead.
  }
  return null;
}
