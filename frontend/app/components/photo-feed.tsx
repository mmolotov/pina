import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  Check,
  Download,
  FolderPlus,
  Heart,
  Play,
  Trash2,
  X,
} from "lucide-react";
import { getPhotoBlob } from "~/lib/api";
import { type MessageKey, useI18n, type Locale } from "~/lib/i18n";
import { selectLibraryTilePreviewVariant } from "~/lib/photo-preview";
import {
  getPhotoMediaKind,
  getPhotoRatio,
  type MediaKind,
} from "~/lib/photo-media";
import {
  buildRailMonths,
  type TimelineZoom,
  type ZoomTimelineGroup,
} from "~/lib/timeline";
import type { PhotoDto } from "~/types/api";

// ═══════════════════════════════════════════════════════════════
// JUSTIFIED ROW BUILDER (Google-Photos style)
// ═══════════════════════════════════════════════════════════════

export interface JustifiedRow {
  photos: PhotoDto[];
  height: number;
}

/**
 * Greedy row builder: accumulate photos until their combined aspect ratios fill
 * the container at the target height, then scale the row to fit exactly. The
 * trailing partial row is kept at the target height so it never blows up.
 */
export function buildJustifiedRows(
  photos: PhotoDto[],
  containerWidth: number,
  targetHeight: number,
  gap: number,
): JustifiedRow[] {
  if (!containerWidth || containerWidth < 100) {
    return [];
  }

  const rows: JustifiedRow[] = [];
  let row: PhotoDto[] = [];
  let ratioSum = 0;

  for (const photo of photos) {
    row.push(photo);
    ratioSum += getPhotoRatio(photo);
    const widthAtTarget = ratioSum * targetHeight + gap * (row.length - 1);
    if (widthAtTarget >= containerWidth) {
      const height = (containerWidth - gap * (row.length - 1)) / ratioSum;
      rows.push({ photos: row, height });
      row = [];
      ratioSum = 0;
    }
  }

  if (row.length > 0) {
    rows.push({ photos: row, height: targetHeight });
  }

  return rows;
}

function useContainerWidth() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(800);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const measure = () => {
      const next = element.getBoundingClientRect().width;
      if (next > 0) {
        setWidth(next);
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

function usePhotoPreview(photo: PhotoDto): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const variant = selectLibraryTilePreviewVariant(photo.variants);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    getPhotoBlob(photo.id, variant)
      .then((blob) => {
        if (cancelled) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setUrl(null);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [photo.id, variant]);

  return url;
}

// ═══════════════════════════════════════════════════════════════
// ZOOM SWITCH
// ═══════════════════════════════════════════════════════════════

const ZOOM_ITEMS: {
  id: TimelineZoom;
  labelKey: MessageKey;
  Icon: typeof CalendarDays;
}[] = [
  { id: "day", labelKey: "app.library.zoom.day", Icon: CalendarDays },
  { id: "month", labelKey: "app.library.zoom.month", Icon: Calendar },
  { id: "year", labelKey: "app.library.zoom.year", Icon: CalendarRange },
];

export function ZoomSwitch({
  zoom,
  onZoomChange,
}: {
  zoom: TimelineZoom;
  onZoomChange: (zoom: TimelineZoom) => void;
}) {
  const { t } = useI18n();
  const activeIndex = ZOOM_ITEMS.findIndex((item) => item.id === zoom);

  return (
    <div
      className="ph-zoom"
      role="tablist"
      aria-label={t("app.library.zoomAria")}
    >
      <span
        className="ph-zoom-thumb"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {ZOOM_ITEMS.map((item) => {
        const Icon = item.Icon;
        const on = item.id === zoom;
        return (
          <button
            aria-selected={on}
            className={`ph-zoom-btn ${on ? "is-on" : ""}`}
            key={item.id}
            onClick={() => onZoomChange(item.id)}
            role="tab"
            type="button"
          >
            <span className="ph-zoom-ico">
              <Icon size={15} />
            </span>
            <span>{t(item.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PHOTO TILE + GRID
// ═══════════════════════════════════════════════════════════════

export function PhotoFeedTile({
  photo,
  width,
  height,
  isFavorite,
  selected,
  onToggleFavorite,
  onToggleSelect,
  photoHref,
}: {
  photo: PhotoDto;
  width?: number;
  height?: number;
  isFavorite: boolean;
  selected: boolean;
  onToggleFavorite: (photoId: string) => void;
  onToggleSelect: (photoId: string) => void;
  photoHref: (photoId: string) => string;
}) {
  const { t } = useI18n();
  const previewUrl = usePhotoPreview(photo);
  const kind = getPhotoMediaKind(photo);

  return (
    <div className="ph-tile" style={{ width, height }}>
      {previewUrl ? (
        <img
          alt={photo.originalFilename}
          className={`ph-tile-fill ${selected ? "is-selected" : ""}`}
          loading="lazy"
          src={previewUrl}
        />
      ) : null}

      <Link
        aria-label={t("app.library.photoTileAria", {
          fileName: photo.originalFilename,
        })}
        className="ph-tile-open"
        to={photoHref(photo.id)}
      />

      {kind !== "photo" ? (
        <span className="ph-badge">
          {kind === "video" ? (
            <Play size={11} fill="currentColor" strokeWidth={0} />
          ) : (
            <span className="ph-badge-text">
              {t("app.library.mediaTypeRaw")}
            </span>
          )}
        </span>
      ) : null}

      <div className="ph-hover" />

      <button
        aria-label={t("app.library.photoCheckboxAria", {
          fileName: photo.originalFilename,
        })}
        aria-pressed={selected}
        className={`ph-check ${selected ? "is-on" : ""}`}
        onClick={() => onToggleSelect(photo.id)}
        type="button"
      >
        {selected ? <Check size={14} strokeWidth={3.5} /> : null}
      </button>

      <button
        aria-label={
          isFavorite
            ? t("app.library.removePhotoFavoriteAria", {
                fileName: photo.originalFilename,
              })
            : t("app.library.addPhotoFavoriteAria", {
                fileName: photo.originalFilename,
              })
        }
        className={`ph-fav-btn ${isFavorite ? "is-on" : ""}`}
        onClick={() => onToggleFavorite(photo.id)}
        type="button"
      >
        <Heart
          fill={isFavorite ? "currentColor" : "none"}
          size={13}
          strokeWidth={2.2}
        />
      </button>
    </div>
  );
}

export function JustifiedPhotoGrid({
  photos,
  targetHeight,
  gap,
  isFavorite,
  isSelected,
  onToggleFavorite,
  onToggleSelect,
  photoHref,
}: {
  photos: PhotoDto[];
  targetHeight: number;
  gap: number;
  isFavorite: (photoId: string) => boolean;
  isSelected: (photoId: string) => boolean;
  onToggleFavorite: (photoId: string) => void;
  onToggleSelect: (photoId: string) => void;
  photoHref: (photoId: string) => string;
}) {
  const [ref, width] = useContainerWidth();
  const rows = useMemo(
    () => buildJustifiedRows(photos, width, targetHeight, gap),
    [photos, width, targetHeight, gap],
  );

  return (
    <div className="ph-justified" ref={ref}>
      {rows.map((row, rowIndex) => (
        <div
          className="ph-just-row"
          key={rowIndex}
          style={{ gap: `${gap}px`, marginBottom: `${gap}px` }}
        >
          {row.photos.map((photo) => (
            <PhotoFeedTile
              height={row.height}
              isFavorite={isFavorite(photo.id)}
              key={photo.id}
              onToggleFavorite={onToggleFavorite}
              onToggleSelect={onToggleSelect}
              photo={photo}
              photoHref={photoHref}
              selected={isSelected(photo.id)}
              width={getPhotoRatio(photo) * row.height}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FILTER BAR
// ═══════════════════════════════════════════════════════════════

export interface PhotoFeedFilters {
  type: MediaKind | null;
  favorite: boolean;
}

export const EMPTY_PHOTO_FILTERS: PhotoFeedFilters = {
  type: null,
  favorite: false,
};

const TYPE_CHIPS: { id: MediaKind | "all"; labelKey: MessageKey }[] = [
  { id: "all", labelKey: "app.library.photoFilterAll" },
  { id: "photo", labelKey: "app.library.photoFilterPhotos" },
  { id: "video", labelKey: "app.library.photoFilterVideos" },
  { id: "raw", labelKey: "app.library.photoFilterRaw" },
];

export function PhotoFilterBar({
  filters,
  onFiltersChange,
}: {
  filters: PhotoFeedFilters;
  onFiltersChange: (filters: PhotoFeedFilters) => void;
}) {
  const { t } = useI18n();
  const hasFilters = filters.type != null || filters.favorite;

  return (
    <div className="ph-filter-bar">
      <div className="ph-filter-group">
        {TYPE_CHIPS.map((chip) => {
          const active =
            chip.id === "all" ? filters.type == null : filters.type === chip.id;
          return (
            <button
              aria-pressed={active}
              className={`ph-chip ${active ? "is-on" : ""}`}
              key={chip.id}
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  type: chip.id === "all" ? null : chip.id,
                })
              }
              type="button"
            >
              {t(chip.labelKey)}
            </button>
          );
        })}
      </div>

      <div className="ph-filter-divider" />

      <button
        aria-pressed={filters.favorite}
        className={`ph-chip ${filters.favorite ? "is-on" : ""}`}
        onClick={() =>
          onFiltersChange({ ...filters, favorite: !filters.favorite })
        }
        type="button"
      >
        <Heart
          fill={filters.favorite ? "currentColor" : "none"}
          size={12}
          strokeWidth={2}
          style={{ marginRight: "0.3rem" }}
        />
        {t("app.library.photoFilterFavorites")}
      </button>

      {hasFilters ? (
        <button
          className="ph-chip-clear"
          onClick={() => onFiltersChange(EMPTY_PHOTO_FILTERS)}
          type="button"
        >
          {t("app.library.photoFilterReset")} ×
        </button>
      ) : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SCRUBBER RAIL
// ═══════════════════════════════════════════════════════════════

function monthName(year: number, month: number, locale: Locale): string {
  const label = new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function PhotoScrubberRail({
  groups,
  activeIndex,
  onJump,
  zoom,
  locale,
}: {
  groups: ZoomTimelineGroup[];
  activeIndex: number;
  onJump: (groupIndex: number) => void;
  zoom: TimelineZoom;
  locale: Locale;
}) {
  const { t } = useI18n();
  const months = useMemo(() => buildRailMonths(groups), [groups]);

  return (
    <div className="ph-rail">
      <p className="eyebrow ph-rail-head">{t("app.library.railTitle")}</p>
      <div className="ph-rail-inner">
        {months.map((month, monthIndex) => {
          const yearChanged =
            monthIndex === 0 || month.year !== months[monthIndex - 1]!.year;
          const isActive = month.days.some(
            (day) => day.groupIdx === activeIndex,
          );
          return (
            <div key={`${month.year}-${month.month}`}>
              {yearChanged ? (
                <p className="ph-rail-year">{month.year}</p>
              ) : null}
              <button
                className={`ph-rail-month ${isActive ? "is-active" : ""}`}
                onClick={() => onJump(month.days[0]!.groupIdx)}
                type="button"
              >
                <span
                  className="ph-rail-month-dot"
                  style={{
                    background: isActive
                      ? "var(--color-accent-strong)"
                      : "var(--color-border-strong)",
                  }}
                />
                <span className="ph-rail-month-name">
                  {monthName(month.year, month.month, locale)}
                </span>
                <span className="ph-rail-month-count">{month.total}</span>
              </button>
              {zoom === "day" ? (
                <div className="ph-rail-days">
                  {month.days.map((day) => (
                    <button
                      aria-label={day.key}
                      className={`ph-rail-day-dot ${
                        day.groupIdx === activeIndex ? "is-active" : ""
                      }`}
                      key={day.key}
                      onClick={() => onJump(day.groupIdx)}
                      style={{
                        height: `${Math.min(28, 6 + day.count * 0.9)}px`,
                      }}
                      title={day.key}
                      type="button"
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BULK ACTION BAR
// ═══════════════════════════════════════════════════════════════

export function PhotoBulkBar({
  count,
  albums,
  busy,
  onClear,
  onFavorite,
  onAddToAlbum,
  onDownload,
  onDelete,
}: {
  count: number;
  albums: { id: string; name: string }[];
  busy: boolean;
  onClear: () => void;
  onFavorite: () => void;
  onAddToAlbum: (albumId: string) => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) {
      return;
    }
    function onMouseDown(event: MouseEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [pickerOpen]);

  if (count === 0) {
    return null;
  }

  return (
    <div
      aria-label={`${count} ${t("app.library.bulkSelectedLabel")}`}
      className="ph-bulkbar"
      role="region"
    >
      <button
        aria-label={t("app.library.clearSelection")}
        className="ph-bulkbar-close"
        onClick={onClear}
        type="button"
      >
        <X size={18} />
      </button>
      <span className="ph-bulkbar-count">
        <strong>{count}</strong> {t("app.library.bulkSelectedLabel")}
      </span>
      <div className="ph-bulkbar-actions">
        <button
          className="ph-bulkbar-act"
          disabled={busy}
          onClick={onFavorite}
          type="button"
        >
          <Heart size={15} />
          {t("app.library.bulkFavorite")}
        </button>
        <div
          ref={pickerRef}
          style={{ display: "inline-flex", position: "relative" }}
        >
          <button
            aria-expanded={pickerOpen}
            aria-haspopup="menu"
            className="ph-bulkbar-act"
            disabled={busy}
            onClick={() => setPickerOpen((value) => !value)}
            type="button"
          >
            <FolderPlus size={15} />
            {t("app.library.bulkAddToAlbum")}
          </button>
          {pickerOpen ? (
            <div className="ph-bulkbar-pop" role="menu">
              <p className="ph-bulkbar-pop-title">
                {t("app.library.bulkAlbumPickerTitle")}
              </p>
              {albums.length === 0 ? (
                <p className="ph-bulkbar-pop-empty">
                  {t("app.library.bulkAlbumPickerEmpty")}
                </p>
              ) : (
                albums.map((album) => (
                  <button
                    className="ph-bulkbar-pop-item"
                    key={album.id}
                    onClick={() => {
                      setPickerOpen(false);
                      onAddToAlbum(album.id);
                    }}
                    role="menuitem"
                    type="button"
                  >
                    {album.name}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
        <button
          className="ph-bulkbar-act"
          disabled={busy}
          onClick={onDownload}
          type="button"
        >
          <Download size={15} />
          {t("app.library.bulkDownload")}
        </button>
        <button
          className="ph-bulkbar-act is-danger"
          disabled={busy}
          onClick={onDelete}
          type="button"
        >
          <Trash2 size={15} />
          {t("app.library.bulkDelete")}
        </button>
      </div>
    </div>
  );
}
