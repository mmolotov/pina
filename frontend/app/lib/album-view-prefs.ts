import { useEffect, useState } from "react";

export type AlbumTileStyle = "card" | "compact" | "list";
export type AlbumHeroStyle = "split" | "banner";

export const ALBUM_TILE_STYLES: readonly AlbumTileStyle[] = [
  "card",
  "compact",
  "list",
];
export const ALBUM_HERO_STYLES: readonly AlbumHeroStyle[] = ["split", "banner"];

const STORAGE_KEY = "pina-album-view-prefs";

interface AlbumViewPrefs {
  tileStyle: AlbumTileStyle;
  columns: number;
  heroStyle: AlbumHeroStyle;
  photoColumns: number;
}

const DEFAULTS: AlbumViewPrefs = {
  tileStyle: "compact",
  columns: 4,
  heroStyle: "banner",
  photoColumns: 4,
};

const COLUMN_MIN = 2;
const COLUMN_MAX = 4;

function clampColumns(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULTS.columns;
  }

  const rounded = Math.round(parsed);
  if (rounded < COLUMN_MIN) return COLUMN_MIN;
  if (rounded > COLUMN_MAX) return COLUMN_MAX;
  return rounded;
}

function readStoredPrefs(): AlbumViewPrefs {
  if (typeof window === "undefined") {
    return DEFAULTS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULTS;
    }

    const parsed = JSON.parse(raw) as Partial<AlbumViewPrefs>;
    return {
      tileStyle: ALBUM_TILE_STYLES.includes(parsed.tileStyle as AlbumTileStyle)
        ? (parsed.tileStyle as AlbumTileStyle)
        : DEFAULTS.tileStyle,
      columns: clampColumns(parsed.columns ?? DEFAULTS.columns),
      heroStyle: ALBUM_HERO_STYLES.includes(parsed.heroStyle as AlbumHeroStyle)
        ? (parsed.heroStyle as AlbumHeroStyle)
        : DEFAULTS.heroStyle,
      photoColumns: clampColumns(parsed.photoColumns ?? DEFAULTS.photoColumns),
    };
  } catch {
    return DEFAULTS;
  }
}

function writeStoredPrefs(prefs: AlbumViewPrefs) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota / access errors — defaults will be used next load
  }
}

export function useAlbumViewPrefs(): {
  prefs: AlbumViewPrefs;
  setTileStyle: (next: AlbumTileStyle) => void;
  setColumns: (next: number) => void;
  setHeroStyle: (next: AlbumHeroStyle) => void;
  setPhotoColumns: (next: number) => void;
} {
  const [prefs, setPrefs] = useState<AlbumViewPrefs>(() => readStoredPrefs());

  useEffect(() => {
    setPrefs(readStoredPrefs());
  }, []);

  function update(next: AlbumViewPrefs) {
    setPrefs(next);
    writeStoredPrefs(next);
  }

  return {
    prefs,
    setTileStyle(next) {
      update({ ...prefs, tileStyle: next });
    },
    setColumns(next) {
      update({ ...prefs, columns: clampColumns(next) });
    },
    setHeroStyle(next) {
      update({ ...prefs, heroStyle: next });
    },
    setPhotoColumns(next) {
      update({ ...prefs, photoColumns: clampColumns(next) });
    },
  };
}

export function getAlbumPaletteIndex(albumId: string): number {
  let hash = 0;
  for (let i = 0; i < albumId.length; i++) {
    hash = (hash * 31 + albumId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 8;
}

export const ALBUM_PHOTO_PALETTE_COUNT = 8;

export function albumPhotoSwatchClass(index: number): string {
  const safe =
    ((index % ALBUM_PHOTO_PALETTE_COUNT) + ALBUM_PHOTO_PALETTE_COUNT) %
    ALBUM_PHOTO_PALETTE_COUNT;
  return `photo-swatch-${safe}`;
}
