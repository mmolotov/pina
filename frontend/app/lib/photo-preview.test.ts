import { describe, expect, it } from "vitest";
import {
  selectAlbumHeroPreviewVariant,
  selectAlbumTilePreviewVariant,
  selectLibraryTilePreviewVariant,
  selectPhotoPreviewVariant,
} from "~/lib/photo-preview";

describe("photo-preview", () => {
  it("keeps small thumbnails on compact low-density library grids", () => {
    expect(selectLibraryTilePreviewVariant([], 390, 1)).toBe("THUMB_XS");
  });

  it("upgrades compact mobile tiles on retina displays", () => {
    expect(selectLibraryTilePreviewVariant([], 390, 3)).toBe("THUMB_SM");
  });

  it("keeps library tiles on the 512px thumbnail when it is sufficient", () => {
    expect(selectLibraryTilePreviewVariant([], 1440, 1)).toBe("THUMB_SM");
  });

  it("keeps album tiles on the 512px thumbnail when it is sufficient", () => {
    expect(selectAlbumTilePreviewVariant([], 1280, 1)).toBe("THUMB_SM");
  });

  it("uses large thumbnails for the album hero on very wide screens", () => {
    expect(selectAlbumHeroPreviewVariant([], 1600, 1)).toBe("THUMB_LG");
  });

  it("upgrades the album hero on mobile retina displays", () => {
    expect(selectAlbumHeroPreviewVariant([], 390, 3)).toBe("THUMB_MD");
  });

  it("falls back to the largest available preview when a larger thumbnail is missing", () => {
    expect(
      selectPhotoPreviewVariant(
        [
          {
            type: "THUMB_XS",
            format: "jpeg",
            width: 256,
            height: 256,
            sizeBytes: 1024,
          },
          {
            type: "THUMB_SM",
            format: "jpeg",
            width: 512,
            height: 512,
            sizeBytes: 2048,
          },
          {
            type: "THUMB_MD",
            format: "jpeg",
            width: 1280,
            height: 720,
            sizeBytes: 8192,
          },
        ],
        1600,
      ),
    ).toBe("THUMB_MD");
  });
});
