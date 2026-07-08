import { describe, expect, it } from "vitest";
import {
  getPhotoMediaKind,
  getPhotoRatio,
  parseExifEntries,
} from "~/lib/photo-media";
import type { PhotoDto } from "~/types/api";

function photo(overrides: Partial<PhotoDto> = {}): PhotoDto {
  return {
    id: "photo-1",
    uploaderId: "user-1",
    originalFilename: "beach.jpg",
    mimeType: "image/jpeg",
    width: 1200,
    height: 800,
    sizeBytes: 1024,
    personalLibraryId: "library-1",
    exifData: null,
    takenAt: null,
    latitude: null,
    longitude: null,
    createdAt: "2026-04-01T10:00:00Z",
    variants: [],
    ...overrides,
  };
}

describe("getPhotoMediaKind", () => {
  it("classifies video mime types as video", () => {
    expect(getPhotoMediaKind(photo({ mimeType: "video/mp4" }))).toBe("video");
  });

  it("classifies raw extensions and raw mime types as raw", () => {
    expect(getPhotoMediaKind(photo({ originalFilename: "IMG_0001.CR3" }))).toBe(
      "raw",
    );
    expect(getPhotoMediaKind(photo({ mimeType: "image/x-canon-raw" }))).toBe(
      "raw",
    );
  });

  it("defaults everything else to photo", () => {
    expect(getPhotoMediaKind(photo())).toBe("photo");
    expect(getPhotoMediaKind(photo({ originalFilename: "crawl.jpg" }))).toBe(
      "photo",
    );
  });
});

describe("getPhotoRatio", () => {
  it("computes width/height when both dimensions are known", () => {
    expect(getPhotoRatio(photo({ width: 1600, height: 800 }))).toBe(2);
  });

  it("falls back to 3:2 when dimensions are missing or degenerate", () => {
    expect(getPhotoRatio(photo({ width: null, height: null }))).toBe(1.5);
    expect(getPhotoRatio(photo({ width: 1200, height: 0 }))).toBe(1.5);
  });
});

describe("parseExifEntries", () => {
  it("returns label/value pairs for a flat JSON object", () => {
    const entries = parseExifEntries(
      JSON.stringify({
        Make: "Canon",
        ISO: 200,
        Nested: { a: 1 },
        Empty: null,
      }),
    );
    expect(entries).toEqual([
      ["Make", "Canon"],
      ["ISO", "200"],
    ]);
  });

  it("returns null for non-JSON, non-object, or empty payloads", () => {
    expect(parseExifEntries(null)).toBeNull();
    expect(parseExifEntries("not json")).toBeNull();
    expect(parseExifEntries(JSON.stringify(["a", "b"]))).toBeNull();
    expect(
      parseExifEntries(JSON.stringify({ only: { nested: true } })),
    ).toBeNull();
  });
});
