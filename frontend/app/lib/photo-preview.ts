import type { PhotoVariantDto } from "~/types/api";

export type PhotoPreviewVariant =
  | "COMPRESSED"
  | "THUMB_XS"
  | "THUMB_SM"
  | "THUMB_MD"
  | "THUMB_LG";

const VARIANT_WIDTHS: Record<PhotoPreviewVariant, number> = {
  THUMB_XS: 256,
  THUMB_SM: 512,
  THUMB_MD: 1280,
  THUMB_LG: 1920,
  COMPRESSED: 2560,
};

function getViewportWidth() {
  if (typeof window === "undefined") {
    return 1280;
  }
  return window.innerWidth;
}

function getDevicePixelRatio() {
  if (typeof window === "undefined") {
    return 1;
  }
  return window.devicePixelRatio || 1;
}

function hasVariant(
  availableTypes: Set<string>,
  variant: PhotoPreviewVariant,
): boolean {
  return availableTypes.size === 0 || availableTypes.has(variant);
}

export function selectPhotoPreviewVariant(
  variants: PhotoVariantDto[],
  targetWidth: number,
): PhotoPreviewVariant {
  const availableTypes = new Set(variants.map((variant) => variant.type));
  const requiredWidth = Math.max(1, Math.ceil(targetWidth));

  for (const variant of [
    "THUMB_XS",
    "THUMB_SM",
    "THUMB_MD",
    "THUMB_LG",
    "COMPRESSED",
  ] as const) {
    if (
      hasVariant(availableTypes, variant) &&
      VARIANT_WIDTHS[variant] >= requiredWidth
    ) {
      return variant;
    }
  }

  for (const variant of [
    "COMPRESSED",
    "THUMB_LG",
    "THUMB_MD",
    "THUMB_SM",
    "THUMB_XS",
  ] as const) {
    if (hasVariant(availableTypes, variant)) {
      return variant;
    }
  }

  return "COMPRESSED";
}

export function selectLibraryTilePreviewVariant(
  variants: PhotoVariantDto[],
  viewportWidth = getViewportWidth(),
  devicePixelRatio = getDevicePixelRatio(),
): PhotoPreviewVariant {
  const targetWidth = viewportWidth >= 1024 ? 320 : 220;
  return selectPhotoPreviewVariant(
    variants,
    targetWidth * Math.max(1, Math.min(devicePixelRatio, 2)),
  );
}

export function selectAlbumTilePreviewVariant(
  variants: PhotoVariantDto[],
  viewportWidth = getViewportWidth(),
  devicePixelRatio = getDevicePixelRatio(),
): PhotoPreviewVariant {
  const targetWidth = viewportWidth >= 1024 ? 420 : 260;
  return selectPhotoPreviewVariant(
    variants,
    targetWidth * Math.max(1, Math.min(devicePixelRatio, 2)),
  );
}

export function selectAlbumListThumbPreviewVariant(
  variants: PhotoVariantDto[],
  devicePixelRatio = getDevicePixelRatio(),
): PhotoPreviewVariant {
  // List-view tile thumb is ~72×54 CSS px; with up to 2x DPR we need at most
  // ~144 px. THUMB_XS (256) covers it with headroom.
  return selectPhotoPreviewVariant(
    variants,
    72 * Math.max(1, Math.min(devicePixelRatio, 2)),
  );
}

export function selectAlbumHeroPreviewVariant(
  variants: PhotoVariantDto[],
  viewportWidth = getViewportWidth(),
  devicePixelRatio = getDevicePixelRatio(),
): PhotoPreviewVariant {
  if (viewportWidth >= 1536) {
    return selectPhotoPreviewVariant(
      variants,
      1400 * Math.max(1, Math.min(devicePixelRatio, 2)),
    );
  }

  if (viewportWidth >= 1024) {
    return selectPhotoPreviewVariant(
      variants,
      960 * Math.max(1, Math.min(devicePixelRatio, 2)),
    );
  }

  return selectPhotoPreviewVariant(
    variants,
    640 * Math.max(1, Math.min(devicePixelRatio, 2)),
  );
}
