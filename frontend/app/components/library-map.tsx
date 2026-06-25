import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Crosshair,
  Globe,
  Maximize,
  MapPin,
  Minus,
  Plus,
  Star,
  X,
  ZoomIn,
} from "lucide-react";
import {
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_MAX_ZOOM,
  MAP_TILE_SUBDOMAINS,
  mapTileUrl,
} from "~/lib/map-config";
import { useI18n, type Locale } from "~/lib/i18n";
import type { ThemeName } from "~/lib/theme";
import type { GeoPhotoDto, PhotoGeoBounds } from "~/types/api";

const SWATCH_COUNT = 12;
const CLUSTER_RADIUS_PX = 56;
const MAX_CLUSTER_THUMBS = 24;

interface MapFilters {
  favorite: boolean;
  album: string | null;
  year: string | null;
}

interface GeoCluster {
  id: string;
  lat: number;
  lng: number;
  members: GeoPhotoDto[];
}

type MapSelection =
  | { kind: "none" }
  | { kind: "photo"; photo: GeoPhotoDto }
  | { kind: "cluster"; photos: GeoPhotoDto[] };

export interface LibraryMapProps {
  photos: GeoPhotoDto[];
  favoritePhotoIds: Set<string>;
  loading: boolean;
  errorMessage: string | null;
  hasGeoTaggedPhotos: boolean;
  theme: ThemeName;
  initialBounds: PhotoGeoBounds;
  onBoundsChange: (bounds: PhotoGeoBounds) => void;
  onOpenPhoto: (photoId: string) => void;
  onRetry: () => void;
}

function swatchIndex(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return hash % SWATCH_COUNT;
}

function swatchClass(id: string): string {
  return `map-swatch-${swatchIndex(id)}`;
}

function photoYear(photo: GeoPhotoDto): string | null {
  const date = photo.takenAt ?? photo.createdAt;
  return date ? date.slice(0, 4) : null;
}

function formatCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
}

function formatGeoDate(value: string | null, locale: Locale): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleDateString(
    locale === "ru" ? "ru-RU" : "en-US",
    { day: "numeric", month: "long", year: "numeric" },
  );
}

function latLngTuples(photos: GeoPhotoDto[]): [number, number][] {
  const tuples: [number, number][] = [];
  for (const photo of photos) {
    if (photo.latitude != null && photo.longitude != null) {
      tuples.push([photo.latitude, photo.longitude]);
    }
  }
  return tuples;
}

/**
 * Proximity clustering by pixel distance at the current zoom. Mirrors a slippy
 * map's native clustering: two markers merge when their projected points are
 * within {@link CLUSTER_RADIUS_PX} pixels, so clusters split apart as you zoom.
 */
function clusterPhotos(
  photos: GeoPhotoDto[],
  map: L.Map,
  radius: number,
): GeoCluster[] {
  const zoom = map.getZoom();
  const points: {
    photo: GeoPhotoDto;
    lat: number;
    lng: number;
    point: L.Point;
  }[] = [];
  for (const photo of photos) {
    if (photo.latitude == null || photo.longitude == null) {
      continue;
    }
    points.push({
      photo,
      lat: photo.latitude,
      lng: photo.longitude,
      point: map.project([photo.latitude, photo.longitude], zoom),
    });
  }

  const used = Array.from({ length: points.length }, () => false);
  const clusters: GeoCluster[] = [];
  for (let i = 0; i < points.length; i += 1) {
    if (used[i]) {
      continue;
    }
    used[i] = true;
    const members = [points[i]];
    for (let j = i + 1; j < points.length; j += 1) {
      if (used[j]) {
        continue;
      }
      if (points[i].point.distanceTo(points[j].point) <= radius) {
        used[j] = true;
        members.push(points[j]);
      }
    }
    const lat = members.reduce((sum, m) => sum + m.lat, 0) / members.length;
    const lng = members.reduce((sum, m) => sum + m.lng, 0) / members.length;
    clusters.push({
      id: `cluster-${i}-${members[0].photo.id}`,
      lat,
      lng,
      members: members.map((m) => m.photo),
    });
  }
  return clusters;
}

function createLeafletMap(element: HTMLElement): L.Map | null {
  try {
    return L.map(element, {
      zoomControl: false,
      attributionControl: true,
      worldCopyJump: true,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
      zoomSnap: 0.5,
    });
  } catch {
    return null;
  }
}

export function LibraryMap({
  photos,
  favoritePhotoIds,
  loading,
  errorMessage,
  hasGeoTaggedPhotos,
  theme,
  initialBounds,
  onBoundsChange,
  onOpenPhoto,
  onRetry,
}: LibraryMapProps) {
  const { locale, t } = useI18n();
  const elementRef = useRef<HTMLDivElement | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const initialBoundsRef = useRef(initialBounds);

  const [map, setMap] = useState<L.Map | null>(null);
  const [, setVersion] = useState(0);
  const [filters, setFilters] = useState<MapFilters>({
    favorite: false,
    album: null,
    year: null,
  });
  const [selection, setSelection] = useState<MapSelection>({ kind: "none" });
  const [myLocation, setMyLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale),
    [locale],
  );

  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
  }, [onBoundsChange]);

  // Initialise the Leaflet map once. Bounds flow one-way after mount: the map
  // drives the URL/viewport (via onBoundsChange), never the reverse, so we read
  // the initial bounds from a ref and never re-fit on prop changes.
  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    const instance = createLeafletMap(element);
    if (!instance) {
      return;
    }

    const bounds = initialBoundsRef.current;
    try {
      instance.fitBounds(
        L.latLngBounds(
          [bounds.swLat, bounds.swLng],
          [bounds.neLat, bounds.neLng],
        ),
        { padding: [40, 40] },
      );
    } catch {
      instance.setView([20, 0], MAP_MIN_ZOOM);
    }

    const handleMove = () => setVersion((value) => value + 1);
    const handleSettle = () => {
      const next = instance.getBounds();
      onBoundsChangeRef.current({
        swLat: next.getSouth(),
        swLng: next.getWest(),
        neLat: next.getNorth(),
        neLng: next.getEast(),
      });
    };
    instance.on("move zoom", handleMove);
    instance.on("moveend zoomend", handleSettle);
    setMap(instance);

    const resizeTimer = window.setTimeout(() => {
      instance.invalidateSize();
      setVersion((value) => value + 1);
    }, 60);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            instance.invalidateSize();
            setVersion((value) => value + 1);
          });
    observer?.observe(element);

    return () => {
      window.clearTimeout(resizeTimer);
      observer?.disconnect();
      instance.off();
      instance.remove();
      tileRef.current = null;
      setMap(null);
    };
  }, []);

  // Tile layer follows the active theme.
  useEffect(() => {
    if (!map) {
      return;
    }
    if (tileRef.current) {
      map.removeLayer(tileRef.current);
      tileRef.current = null;
    }
    tileRef.current = L.tileLayer(mapTileUrl(theme), {
      attribution: MAP_TILE_ATTRIBUTION,
      subdomains: MAP_TILE_SUBDOMAINS,
      maxZoom: MAP_TILE_MAX_ZOOM,
      detectRetina: true,
    }).addTo(map);
  }, [map, theme]);

  const albumOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const photo of photos) {
      for (const album of photo.albums) {
        if (!byId.has(album.id)) {
          byId.set(album.id, album.name);
        }
      }
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [photos]);

  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    for (const photo of photos) {
      const year = photoYear(photo);
      if (year) {
        years.add(year);
      }
    }
    return [...years].sort().reverse();
  }, [photos]);

  const filteredPhotos = useMemo(
    () =>
      photos.filter((photo) => {
        if (filters.favorite && !favoritePhotoIds.has(photo.id)) {
          return false;
        }
        if (
          filters.album &&
          !photo.albums.some((album) => album.id === filters.album)
        ) {
          return false;
        }
        if (filters.year && photoYear(photo) !== filters.year) {
          return false;
        }
        return true;
      }),
    [photos, filters, favoritePhotoIds],
  );

  const hasActiveFilter =
    filters.favorite || filters.album != null || filters.year != null;

  const resetSelection = () => setSelection({ kind: "none" });

  const isClusterSelected = (cluster: GeoCluster): boolean => {
    if (selection.kind === "photo") {
      return (
        cluster.members.length === 1 &&
        cluster.members[0].id === selection.photo.id
      );
    }
    if (selection.kind === "cluster") {
      const selectedIds = new Set(selection.photos.map((photo) => photo.id));
      return cluster.members.some((member) => selectedIds.has(member.id));
    }
    return false;
  };

  const fitToPhotos = () => {
    if (!map) {
      return;
    }
    const tuples = latLngTuples(
      filteredPhotos.length > 0 ? filteredPhotos : photos,
    );
    if (tuples.length > 0) {
      map.fitBounds(L.latLngBounds(tuples), { padding: [70, 70] });
    }
  };

  const zoomToCluster = () => {
    if (!map || selection.kind !== "cluster") {
      return;
    }
    const tuples = latLngTuples(selection.photos);
    if (tuples.length > 0) {
      map.fitBounds(L.latLngBounds(tuples), { padding: [80, 80], maxZoom: 15 });
    }
  };

  const goToWorld = () => {
    resetSelection();
    map?.setView([20, 0], MAP_MIN_ZOOM);
  };

  const locateMe = () => {
    if (!map || typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }
    navigator.geolocation.getCurrentPosition((position) => {
      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      setMyLocation(location);
      map.flyTo([location.lat, location.lng], 11, { duration: 0.8 });
    });
  };

  let clusters: GeoCluster[] = [];
  let markersInView = 0;
  let photosInView = 0;
  if (map) {
    clusters = clusterPhotos(filteredPhotos, map, CLUSTER_RADIUS_PX);
    const bounds = map.getBounds();
    for (const cluster of clusters) {
      if (bounds.contains([cluster.lat, cluster.lng])) {
        markersInView += 1;
        photosInView += cluster.members.length;
      }
    }
  }

  const showChrome = hasGeoTaggedPhotos && errorMessage == null;
  const showLoading = loading && hasGeoTaggedPhotos && errorMessage == null;
  const showNoGps = !hasGeoTaggedPhotos && errorMessage == null;
  const showAreaEmpty =
    map != null &&
    hasGeoTaggedPhotos &&
    !loading &&
    errorMessage == null &&
    markersInView === 0;

  return (
    <div
      className="map-screen"
      role="region"
      aria-label={t("app.library.view.map")}
    >
      <div className="map-shell">
        <div
          ref={elementRef}
          className={`map-canvas ${map ? "" : "is-blank"}`}
        />

        {map && showChrome ? (
          <div className="map-markers">
            {clusters.map((cluster) => {
              const point = map.latLngToContainerPoint([
                cluster.lat,
                cluster.lng,
              ]);
              const selected = isClusterSelected(cluster);
              if (cluster.members.length === 1) {
                const photo = cluster.members[0];
                const favorite = favoritePhotoIds.has(photo.id);
                return (
                  <button
                    key={cluster.id}
                    type="button"
                    className={`map-marker ${selected ? "is-selected" : ""} ${
                      favorite ? "fav" : ""
                    }`}
                    style={{ left: point.x, top: point.y }}
                    aria-label={t("app.library.openMarkerAria", {
                      fileName: photo.originalFilename,
                    })}
                    aria-pressed={selected}
                    onClick={() => setSelection({ kind: "photo", photo })}
                  >
                    <span className="pin-frame">
                      <span className={`pin-photo ${swatchClass(photo.id)}`} />
                    </span>
                    {favorite ? (
                      <span className="pin-fav">
                        <Star size={9} fill="currentColor" />
                      </span>
                    ) : null}
                  </button>
                );
              }
              const cover =
                cluster.members.find((member) =>
                  favoritePhotoIds.has(member.id),
                ) ?? cluster.members[0];
              return (
                <button
                  key={cluster.id}
                  type="button"
                  className={`map-marker map-marker-cluster ${
                    selected ? "is-selected" : ""
                  }`}
                  style={{ left: point.x, top: point.y }}
                  aria-label={t("app.library.openClusterAria", {
                    count: numberFormatter.format(cluster.members.length),
                  })}
                  aria-pressed={selected}
                  onClick={() =>
                    setSelection({ kind: "cluster", photos: cluster.members })
                  }
                >
                  <span className="pin-frame">
                    <span className={`pin-photo ${swatchClass(cover.id)}`} />
                    <span className="pin-veil" />
                    <span className="pin-count">{cluster.members.length}</span>
                  </span>
                </button>
              );
            })}

            {myLocation
              ? (() => {
                  const point = map.latLngToContainerPoint([
                    myLocation.lat,
                    myLocation.lng,
                  ]);
                  return (
                    <div
                      className="map-myloc"
                      style={{ left: point.x, top: point.y }}
                    >
                      <span className="map-myloc-ring" />
                      <span className="map-myloc-dot" />
                    </div>
                  );
                })()
              : null}
          </div>
        ) : null}

        {showChrome ? (
          <div
            className="map-toolbar"
            role="toolbar"
            aria-label={t("app.library.map.toolbarLabel")}
          >
            <div className="map-toolbar-group">
              <button
                type="button"
                className={`map-fchip ${filters.favorite ? "is-on" : ""}`}
                aria-pressed={filters.favorite}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    favorite: !current.favorite,
                  }))
                }
              >
                <Star
                  size={14}
                  fill={filters.favorite ? "currentColor" : "none"}
                />
                <span className="map-fchip-txt">
                  {t("app.library.map.filterFavorites")}
                </span>
              </button>
            </div>
            <span className="map-fdivider" />
            <select
              className={`map-fselect ${filters.album ? "is-on" : ""}`}
              aria-label={t("app.library.map.filterAlbumLabel")}
              value={filters.album ?? ""}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  album: event.target.value || null,
                }))
              }
            >
              <option value="">{t("app.library.map.filterAllAlbums")}</option>
              {albumOptions.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.name}
                </option>
              ))}
            </select>
            <select
              className={`map-fselect ${filters.year ? "is-on" : ""}`}
              aria-label={t("app.library.map.filterYearLabel")}
              value={filters.year ?? ""}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  year: event.target.value || null,
                }))
              }
            >
              <option value="">{t("app.library.map.filterAllYears")}</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            {hasActiveFilter ? (
              <button
                type="button"
                className="map-fclear"
                onClick={() =>
                  setFilters({ favorite: false, album: null, year: null })
                }
              >
                {t("app.library.map.filterReset")} ×
              </button>
            ) : null}
          </div>
        ) : null}

        {hasGeoTaggedPhotos ? (
          <div className="map-controls">
            <button
              type="button"
              className="map-ctrl-btn map-ctrl-solo"
              title={t("app.library.map.locate")}
              aria-label={t("app.library.map.locate")}
              onClick={locateMe}
            >
              <Crosshair size={18} />
            </button>
            <div className="map-ctrl-group">
              <button
                type="button"
                className="map-ctrl-btn"
                title={t("app.library.map.fit")}
                aria-label={t("app.library.map.fit")}
                onClick={fitToPhotos}
              >
                <Maximize size={18} />
              </button>
              <button
                type="button"
                className="map-ctrl-btn"
                title={t("app.library.worldView")}
                aria-label={t("app.library.worldView")}
                onClick={goToWorld}
              >
                <Globe size={18} />
              </button>
            </div>
            <div className="map-ctrl-group">
              <button
                type="button"
                className="map-ctrl-btn"
                title={t("app.library.zoomIn")}
                aria-label={t("app.library.zoomIn")}
                onClick={() => map?.zoomIn()}
              >
                <Plus size={18} />
              </button>
              <button
                type="button"
                className="map-ctrl-btn"
                title={t("app.library.zoomOut")}
                aria-label={t("app.library.zoomOut")}
                onClick={() => map?.zoomOut()}
              >
                <Minus size={18} />
              </button>
            </div>
          </div>
        ) : null}

        {map && showChrome ? (
          <div className="map-counters" aria-live="polite">
            <span>
              {t("app.library.map.markersInView")}:{" "}
              <strong>{numberFormatter.format(markersInView)}</strong>
            </span>
            <span className="map-counters-sep" />
            <span>
              {t("app.library.map.photosInView")}:{" "}
              <strong>{numberFormatter.format(photosInView)}</strong>
            </span>
          </div>
        ) : null}

        {selection.kind !== "none" ? (
          <MapDetailPanel
            selection={selection}
            locale={locale}
            favoritePhotoIds={favoritePhotoIds}
            numberFormatter={numberFormatter}
            onClose={resetSelection}
            onPickPhoto={(photo) => setSelection({ kind: "photo", photo })}
            onZoomToCluster={zoomToCluster}
            onOpenPhoto={onOpenPhoto}
          />
        ) : null}

        {showLoading ? (
          <div className="map-overlay-fill">
            <div className="map-loading">
              <span className="map-spinner" />
              <span>{t("app.library.loadingMarkers")}</span>
            </div>
          </div>
        ) : null}

        {showAreaEmpty ? (
          <div className="map-overlay-fill">
            <div className="map-empty">
              <span className="map-empty-glyph">
                <MapPin size={26} />
              </span>
              <h3 className="map-empty-title">
                {t("app.library.noGeoPhotosViewportTitle")}
              </h3>
              <p className="map-empty-sub">
                {t("app.library.noGeoPhotosViewportDescription")}
              </p>
              <div className="map-empty-cta">
                <button
                  type="button"
                  className="button-primary btn-sm"
                  onClick={fitToPhotos}
                >
                  {t("app.library.map.fit")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showNoGps ? (
          <div className="map-overlay-fill">
            <div className="map-empty">
              <span className="map-empty-glyph">
                <Globe size={26} />
              </span>
              <h3 className="map-empty-title">
                {t("app.library.noGeoPhotosTitle")}
              </h3>
              <p className="map-empty-sub">
                {t("app.library.noGeoPhotosDescription")}
              </p>
            </div>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="map-inline-msg" role="alert">
            <span>{errorMessage}</span>
            <button type="button" onClick={onRetry}>
              {t("app.library.map.retry")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface MapDetailPanelProps {
  selection: Extract<MapSelection, { kind: "photo" | "cluster" }>;
  locale: Locale;
  favoritePhotoIds: Set<string>;
  numberFormatter: Intl.NumberFormat;
  onClose: () => void;
  onPickPhoto: (photo: GeoPhotoDto) => void;
  onZoomToCluster: () => void;
  onOpenPhoto: (photoId: string) => void;
}

function MapDetailPanel({
  selection,
  locale,
  favoritePhotoIds,
  numberFormatter,
  onClose,
  onPickPhoto,
  onZoomToCluster,
  onOpenPhoto,
}: MapDetailPanelProps) {
  const { t } = useI18n();
  const isCluster = selection.kind === "cluster";
  const title = isCluster
    ? t("app.library.clusterTitle", {
        count: numberFormatter.format(selection.photos.length),
      })
    : selection.photo.originalFilename;

  return (
    <aside className="map-detail" aria-label={title}>
      <div className="map-detail-head">
        <div style={{ minWidth: 0 }}>
          <h2 className="map-detail-title">{title}</h2>
        </div>
        <button
          type="button"
          className="map-detail-close"
          aria-label={t("app.library.map.closePanel")}
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      <div className="map-detail-body">
        {isCluster ? (
          <>
            <button
              type="button"
              className="button-secondary btn-sm"
              style={{ alignSelf: "flex-start" }}
              onClick={onZoomToCluster}
            >
              <ZoomIn size={15} /> {t("app.library.zoomIntoCluster")}
            </button>
            <div className="map-thumbs">
              {selection.photos.slice(0, MAX_CLUSTER_THUMBS).map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  className="map-thumb"
                  aria-label={photo.originalFilename}
                  onClick={() => onPickPhoto(photo)}
                >
                  <span className={`map-thumb-fill ${swatchClass(photo.id)}`} />
                  {favoritePhotoIds.has(photo.id) ? (
                    <span className="map-thumb-fav">
                      <Star size={12} fill="currentColor" />
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className={`map-preview ${swatchClass(selection.photo.id)}`} />
            <div className="map-meta">
              <MapMetaRow
                label={t("app.library.map.fieldName")}
                value={selection.photo.originalFilename}
              />
              <MapMetaRow
                label={t("app.library.map.fieldCoords")}
                value={
                  selection.photo.latitude != null &&
                  selection.photo.longitude != null
                    ? formatCoordinates(
                        selection.photo.latitude,
                        selection.photo.longitude,
                      )
                    : "—"
                }
              />
              <MapMetaRow
                label={t("app.library.map.fieldDate")}
                value={formatGeoDate(selection.photo.takenAt, locale)}
              />
              <MapMetaRow
                label={t("app.library.map.fieldAlbum")}
                value={
                  selection.photo.albums.length > 0 ? (
                    selection.photo.albums.map((album) => album.name).join(", ")
                  ) : (
                    <span className="nil">{t("app.library.map.noAlbum")}</span>
                  )
                }
              />
            </div>
          </>
        )}
      </div>

      <div className="map-detail-foot">
        {selection.kind === "photo" ? (
          <button
            type="button"
            className="button-primary btn-sm"
            style={{ flex: 1 }}
            onClick={() => onOpenPhoto(selection.photo.id)}
          >
            {t("app.library.openPhotoDetail")}
          </button>
        ) : null}
        <button
          type="button"
          className="button-secondary btn-sm"
          style={{ flex: isCluster ? 1 : "0 0 auto" }}
          onClick={onClose}
        >
          {t("app.library.clearSelection")}
        </button>
      </div>
    </aside>
  );
}

function MapMetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="map-meta-row">
      <span className="map-meta-label">{label}</span>
      <span className="map-meta-value">{value}</span>
    </div>
  );
}
