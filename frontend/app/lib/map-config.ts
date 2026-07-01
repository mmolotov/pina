import type { ThemeName } from "~/lib/theme";

/**
 * Base-map tile configuration for the library map.
 *
 * Defaults to CARTO's light/dark basemaps (free for low-volume use, no API key)
 * which are visually matched to the app's themes. Every value can be overridden
 * at build time so the tile provider can be swapped — or pointed at a
 * self-hosted tile server — without code changes:
 *
 *   VITE_MAP_TILE_URL_LIGHT, VITE_MAP_TILE_URL_DARK, VITE_MAP_TILE_ATTRIBUTION
 *
 * Leaflet raster XYZ templates are expected ({s}/{z}/{x}/{y}{r}).
 */
const CARTO_LIGHT_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const CARTO_DARK_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export const MAP_TILE_URL_LIGHT =
  import.meta.env.VITE_MAP_TILE_URL_LIGHT ?? CARTO_LIGHT_TILE_URL;
export const MAP_TILE_URL_DARK =
  import.meta.env.VITE_MAP_TILE_URL_DARK ?? CARTO_DARK_TILE_URL;
export const MAP_TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_TILE_ATTRIBUTION ?? CARTO_ATTRIBUTION;

export const MAP_TILE_SUBDOMAINS = "abcd";
export const MAP_TILE_MAX_ZOOM = 19;
export const MAP_MIN_ZOOM = 2;
export const MAP_MAX_ZOOM = 18;

export function mapTileUrl(theme: ThemeName): string {
  return theme === "dark" ? MAP_TILE_URL_DARK : MAP_TILE_URL_LIGHT;
}
