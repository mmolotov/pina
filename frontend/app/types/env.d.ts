/// <reference types="vite/client" />

// Map tile configuration is supplied at build time so the tile provider can be
// swapped (or self-hosted) without code changes. Defaults live in
// app/lib/map-config.ts (CARTO light/dark basemaps).
interface ImportMetaEnv {
  readonly VITE_MAP_TILE_URL_LIGHT?: string;
  readonly VITE_MAP_TILE_URL_DARK?: string;
  readonly VITE_MAP_TILE_ATTRIBUTION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
