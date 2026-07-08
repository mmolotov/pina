import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ALBUM_PHOTO_PALETTE_COUNT,
  albumPhotoSwatchClass,
  getAlbumPaletteIndex,
  useAlbumViewPrefs,
} from "~/lib/album-view-prefs";

const STORAGE_KEY = "pina-album-view-prefs";

describe("useAlbumViewPrefs", () => {
  it("starts from the defaults when nothing is stored", () => {
    const { result } = renderHook(() => useAlbumViewPrefs());
    expect(result.current.prefs).toEqual({
      tileStyle: "compact",
      columns: 4,
      heroStyle: "banner",
      photoColumns: 4,
    });
  });

  it("clamps column updates into the 2..4 range and persists them", () => {
    const { result } = renderHook(() => useAlbumViewPrefs());

    act(() => result.current.setColumns(1));
    expect(result.current.prefs.columns).toBe(2);

    act(() => result.current.setColumns(99));
    expect(result.current.prefs.columns).toBe(4);

    act(() => result.current.setTileStyle("list"));
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toMatchObject({ columns: 4, tileStyle: "list" });
  });

  it("reads stored preferences and sanitizes junk values", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tileStyle: "hologram",
        columns: "3",
        heroStyle: "split",
        photoColumns: -5,
      }),
    );
    const { result } = renderHook(() => useAlbumViewPrefs());
    expect(result.current.prefs).toEqual({
      tileStyle: "compact",
      columns: 3,
      heroStyle: "split",
      photoColumns: 2,
    });
  });

  it("falls back to defaults for unparseable storage", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");
    const { result } = renderHook(() => useAlbumViewPrefs());
    expect(result.current.prefs.tileStyle).toBe("compact");
  });
});

describe("getAlbumPaletteIndex", () => {
  it("is deterministic and stays within the palette", () => {
    const first = getAlbumPaletteIndex("album-1");
    expect(getAlbumPaletteIndex("album-1")).toBe(first);
    for (const id of ["", "a", "album-2", "x".repeat(100)]) {
      const index = getAlbumPaletteIndex(id);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(8);
    }
  });
});

describe("albumPhotoSwatchClass", () => {
  it("wraps any integer into a palette class", () => {
    expect(albumPhotoSwatchClass(0)).toBe("photo-swatch-0");
    expect(albumPhotoSwatchClass(ALBUM_PHOTO_PALETTE_COUNT + 1)).toBe(
      "photo-swatch-1",
    );
    expect(albumPhotoSwatchClass(-1)).toBe(
      `photo-swatch-${ALBUM_PHOTO_PALETTE_COUNT - 1}`,
    );
  });
});
