import type { Route } from "./+types/app-library";
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Form,
  Link,
  useActionData,
  useNavigation,
  useRevalidator,
  useSearchParams,
} from "react-router";
import {
  EmptyHint,
  EmptyState,
  InlineMessage,
  Panel,
  SurfaceCard,
} from "~/components/ui";
import {
  ApiError,
  addFavorite,
  addPhotoToAlbum,
  createAlbum,
  deleteAlbum,
  deletePhoto,
  getPhotoBlob,
  listGeoPhotos,
  listAllAlbumPhotos,
  listAllPhotos,
  listAlbums,
  listFavorites,
  removeFavorite,
  removePhotoFromAlbum,
  updateAlbum,
  uploadPhoto,
} from "~/lib/api";
import { formatBytes, formatRelativeCount } from "~/lib/format";
import {
  applyGeoViewportToSearchParams,
  buildGeoClusters,
  DEFAULT_GEO_VIEWPORT,
  panGeoViewport,
  parseGeoViewportFromSearchParams,
  zoomToClusterBounds,
  zoomGeoViewport,
} from "~/lib/geo";
import {
  getActiveLocale,
  translateMessage,
  useI18n,
  type Locale,
} from "~/lib/i18n";
import { resolveActionIntent, toActionErrorMessage } from "~/lib/route-actions";
import type {
  AlbumDto,
  FavoriteDto,
  PhotoDto,
  PhotoGeoBounds,
} from "~/types/api";

interface AlbumWithPhotos extends AlbumDto {
  photos: PhotoDto[];
}

type LibraryView = "everything" | "photos" | "timeline" | "albums" | "map";
type TimelineGroup = {
  dayKey: string;
  photos: PhotoDto[];
};

interface GeoMapState {
  items: PhotoDto[];
  loading: boolean;
  errorMessage: string | null;
}

type GeoSelectionTarget = {
  id: string;
  kind: "cluster" | "photo";
};

interface LibraryLoaderData {
  photos: PhotoDto[];
  albums: AlbumWithPhotos[];
  photoFavorites: Record<string, FavoriteDto>;
  albumFavorites: Record<string, FavoriteDto>;
}

interface UploadProgressState {
  total: number;
  completed: number;
  currentFileName: string | null;
}

type LibraryActionResult =
  | {
      ok: true;
      intent:
        | "delete-photo"
        | "create-album"
        | "update-album"
        | "delete-album"
        | "add-photo-to-album"
        | "remove-photo-from-album";
      albumId?: string;
    }
  | {
      ok: false;
      intent:
        | "delete-photo"
        | "create-album"
        | "update-album"
        | "delete-album"
        | "add-photo-to-album"
        | "remove-photo-from-album";
      errorMessage: string;
    };

function buildAlbumEditorDrafts(albums: AlbumWithPhotos[]) {
  return Object.fromEntries(
    albums.map((album) => [
      album.id,
      {
        name: album.name,
        description: album.description ?? "",
      },
    ]),
  );
}

function buildAlbumPhotoSelection(albums: AlbumWithPhotos[]) {
  return Object.fromEntries(albums.map((album) => [album.id, ""]));
}

function getSupportedUploadFiles(files: Iterable<File>) {
  return Array.from(files).filter(
    (file) => file.type === "image/jpeg" || file.type === "image/png",
  );
}

function formatUploadSummary(
  uploadedCount: number,
  totalCount: number,
  locale: Locale,
) {
  if (uploadedCount === totalCount) {
    return uploadedCount === 1
      ? translateMessage(locale, "app.library.uploadSummarySingle")
      : translateMessage(locale, "app.library.uploadSummaryPlural", {
          count: new Intl.NumberFormat(locale).format(uploadedCount),
        });
  }

  return translateMessage(locale, "app.library.uploadSummaryPartial", {
    uploadedCount: new Intl.NumberFormat(locale).format(uploadedCount),
    totalCount: new Intl.NumberFormat(locale).format(totalCount),
  });
}

function dayKeyForPhoto(photo: PhotoDto) {
  const value = photo.takenAt ?? photo.createdAt;
  return value.slice(0, 10);
}

function resolveLibraryView(value: string | null): LibraryView {
  return value === "timeline" || value === "albums" || value === "map"
    ? value
    : "photos";
}

function formatCoordinate(value: number | null) {
  return value == null ? "—" : value.toFixed(4);
}

function buildDaySectionId(dayKey: string) {
  return `library-day-${dayKey}`;
}

/**
 * Minimum fraction of a month's photos a single day must have
 * to appear as its own dot on the proportional timeline.
 */
const DAY_SIGNIFICANCE_THRESHOLD = 0.15;

interface TimelineMarker {
  type: "year" | "month" | "day";
  key: string;
  label: string;
  scrollToDayKey: string;
  photoCount: number;
  /** 0-1 position along the full rail height */
  position: number;
}

function buildProportionalTimeline(
  timelineGroups: TimelineGroup[],
  locale: Locale,
): TimelineMarker[] {
  if (timelineGroups.length === 0) return [];

  // Group photos by year and month
  const yearMap = new Map<
    number,
    {
      count: number;
      months: Map<
        number,
        { count: number; days: Map<string, { count: number; dayKey: string }> }
      >;
    }
  >();

  for (const group of timelineGroups) {
    const date = new Date(`${group.dayKey}T00:00:00Z`);
    const year = date.getFullYear();
    const month = date.getMonth();

    if (!yearMap.has(year)) {
      yearMap.set(year, { count: 0, months: new Map() });
    }
    const yearEntry = yearMap.get(year)!;
    yearEntry.count += group.photos.length;

    if (!yearEntry.months.has(month)) {
      yearEntry.months.set(month, { count: 0, days: new Map() });
    }
    const monthEntry = yearEntry.months.get(month)!;
    monthEntry.count += group.photos.length;
    monthEntry.days.set(group.dayKey, {
      count: group.photos.length,
      dayKey: group.dayKey,
    });
  }

  // Total photos for proportional sizing
  const totalPhotos = timelineGroups.reduce(
    (sum, group) => sum + group.photos.length,
    0,
  );
  if (totalPhotos === 0) return [];

  // Sort years descending (newest first = top)
  const sortedYears = Array.from(yearMap.entries()).sort(([a], [b]) => b - a);

  const markers: TimelineMarker[] = [];
  let cumulativePhotos = 0;

  for (const [year, yearEntry] of sortedYears) {
    // Year marker at start of this year's segment
    const yearPosition = cumulativePhotos / totalPhotos;
    const sortedMonths = Array.from(yearEntry.months.entries()).sort(
      ([a], [b]) => b - a,
    );
    const firstMonthDays = sortedMonths[0]?.[1].days;
    const firstDayKey = firstMonthDays
      ? Array.from(firstMonthDays.keys()).sort().reverse()[0]!
      : timelineGroups[0]!.dayKey;

    markers.push({
      type: "year",
      key: `${year}`,
      label: `${year}`,
      scrollToDayKey: firstDayKey,
      photoCount: yearEntry.count,
      position: yearPosition,
    });

    for (const [month, monthEntry] of sortedMonths) {
      const monthPosition = cumulativePhotos / totalPhotos;
      const monthDate = new Date(Date.UTC(year, month, 1));
      const monthLabel = monthDate.toLocaleString(locale, { month: "short" });
      const sortedDays = Array.from(monthEntry.days.entries()).sort(
        ([a], [b]) => b.localeCompare(a),
      );
      const firstMonthDayKey = sortedDays[0]?.[1].dayKey ?? firstDayKey;

      markers.push({
        type: "month",
        key: `${year}-${String(month + 1).padStart(2, "0")}`,
        label: monthLabel,
        scrollToDayKey: firstMonthDayKey,
        photoCount: monthEntry.count,
        position: monthPosition,
      });

      // Add significant days
      for (const [, dayEntry] of sortedDays) {
        const dayPosition = cumulativePhotos / totalPhotos;
        const fraction = dayEntry.count / monthEntry.count;

        if (fraction >= DAY_SIGNIFICANCE_THRESHOLD) {
          const dayDate = new Date(`${dayEntry.dayKey}T00:00:00Z`);
          markers.push({
            type: "day",
            key: dayEntry.dayKey,
            label: dayDate.toLocaleString(locale, {
              month: "short",
              day: "numeric",
            }),
            scrollToDayKey: dayEntry.dayKey,
            photoCount: dayEntry.count,
            position: dayPosition,
          });
        }

        cumulativePhotos += dayEntry.count;
      }
    }
  }

  // Blend proportional positions with uniform spacing to guarantee
  // a minimum gap between labels while preserving proportionality.
  // MIN_LABEL_GAP_PX ≈ minimum pixels between labels at typical rail height.
  // The blend factor is just enough to prevent overlap.
  markers.sort((a, b) => a.position - b.position);
  const n = markers.length;
  if (n > 1) {
    const MIN_GAP = 0.025; // minimum gap as fraction of rail
    // Check if any gaps are too small
    let needsBlend = false;
    for (let i = 1; i < n; i++) {
      if (markers[i]!.position - markers[i - 1]!.position < MIN_GAP) {
        needsBlend = true;
        break;
      }
    }
    if (needsBlend) {
      // Find the smallest blend factor (0–1) that gives every pair >= MIN_GAP.
      // uniform(i) = i / (n - 1), blended = (1-t)*proportional + t*uniform
      // We binary-search for the smallest t.
      let lo = 0;
      let hi = 1;
      for (let iter = 0; iter < 20; iter++) {
        const mid = (lo + hi) / 2;
        let ok = true;
        let prevPos = (1 - mid) * markers[0]!.position;
        for (let i = 1; i < n; i++) {
          const uniform = i / (n - 1);
          const blended = (1 - mid) * markers[i]!.position + mid * uniform;
          if (blended - prevPos < MIN_GAP) {
            ok = false;
            break;
          }
          prevPos = blended;
        }
        if (ok) {
          hi = mid;
        } else {
          lo = mid;
        }
      }
      const t = hi;
      for (let i = 0; i < n; i++) {
        const uniform = i / (n - 1);
        markers[i]!.position = (1 - t) * markers[i]!.position + t * uniform;
      }
    }
  }

  // Remap positions from [0,1] to [pad, 1-pad] so top/bottom markers
  // don't sit flush against the container edges (toolbar overlap fix).
  const pad = 0.04;
  const range = 1 - 2 * pad;
  for (const m of markers) {
    m.position = pad + m.position * range;
  }

  return markers;
}

function dateAtPosition(
  position: number,
  timelineGroups: TimelineGroup[],
  locale: Locale,
): { label: string; dayKey: string } | null {
  if (timelineGroups.length === 0) return null;

  const totalPhotos = timelineGroups.reduce(
    (sum, g) => sum + g.photos.length,
    0,
  );
  const targetCount = Math.floor(position * totalPhotos);

  let cumulative = 0;
  for (const group of timelineGroups) {
    cumulative += group.photos.length;
    if (cumulative >= targetCount) {
      const date = new Date(`${group.dayKey}T00:00:00Z`);
      return {
        label: date.toLocaleDateString(locale, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        dayKey: group.dayKey,
      };
    }
  }

  const last = timelineGroups[timelineGroups.length - 1]!;
  const date = new Date(`${last.dayKey}T00:00:00Z`);
  return {
    label: date.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    dayKey: last.dayKey,
  };
}

function ProportionalTimelineRail(props: {
  timelineGroups: TimelineGroup[];
  markers: TimelineMarker[];
  locale: Locale;
  totalPhotos: number;
  totalDays: number;
  photoForms: Record<string, string>;
  dayGroupForms: Record<string, string>;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [hoverState, setHoverState] = useState<{
    label: string;
    topPx: number;
  } | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const positionToInfo = useCallback(
    (clientY: number) => {
      const el = railRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const position = Math.max(
        0,
        Math.min(1, (clientY - rect.top) / rect.height),
      );
      const info = dateAtPosition(position, props.timelineGroups, props.locale);
      return info ? { ...info, topPx: clientY - rect.top, position } : null;
    },
    [props.timelineGroups, props.locale],
  );

  const scrollToPosition = useCallback(
    (clientY: number) => {
      const info = positionToInfo(clientY);
      if (info) {
        document
          .getElementById(buildDaySectionId(info.dayKey))
          ?.scrollIntoView({ behavior: "auto", block: "start" });
      }
    },
    [positionToInfo],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const info = positionToInfo(e.clientY);
      setHoverState(info ? { label: info.label, topPx: info.topPx } : null);
      if (isDraggingRef.current) {
        scrollToPosition(e.clientY);
      }
    },
    [positionToInfo, scrollToPosition],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only left button
      if (e.button !== 0) return;
      e.preventDefault();
      isDraggingRef.current = true;
      setIsDragging(true);
      scrollToPosition(e.clientY);

      const handleGlobalMove = (ev: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const info = positionToInfo(ev.clientY);
        if (info) {
          setHoverState({ label: info.label, topPx: info.topPx });
          scrollToPosition(ev.clientY);
        }
      };

      const handleGlobalUp = () => {
        isDraggingRef.current = false;
        setIsDragging(false);
        document.removeEventListener("mousemove", handleGlobalMove);
        document.removeEventListener("mouseup", handleGlobalUp);
      };

      document.addEventListener("mousemove", handleGlobalMove);
      document.addEventListener("mouseup", handleGlobalUp);
    },
    [positionToInfo, scrollToPosition],
  );

  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Don't clear hover state while dragging — global mousemove handles it
    setIsHovering(false);
    if (!isDraggingRef.current) {
      setHoverState(null);
    }
  }, []);

  // Build visible labels: years always show, months always show but
  // get combined with their year if at the same position.
  const visibleLabels = useMemo(() => {
    const yearAndMonthMarkers = props.markers.filter(
      (m) => m.type === "year" || m.type === "month",
    );

    // First pass: merge year + its first month into "Mon Year" label.
    // The first month is the one closest to the year marker's position.
    const merged: TimelineMarker[] = [];
    const consumedMonths = new Set<string>();

    for (const marker of yearAndMonthMarkers) {
      if (marker.type === "year") {
        // Find the first month belonging to this year (closest position)
        const yearMonths = yearAndMonthMarkers
          .filter(
            (m) => m.type === "month" && m.key.startsWith(marker.key + "-"),
          )
          .sort((a, b) => a.position - b.position);
        const firstMonth = yearMonths[0];
        if (firstMonth) {
          merged.push({
            ...marker,
            label: `${firstMonth.label} ${marker.label}`,
          });
          consumedMonths.add(firstMonth.key);
        } else {
          merged.push(marker);
        }
      } else if (!consumedMonths.has(marker.key)) {
        merged.push(marker);
      }
    }

    // Second pass: remove labels that are too close to each other.
    // Minimum gap = 2.5% of rail height.
    const minGap = 0.025;
    const result: TimelineMarker[] = [];
    let lastPos = -1;

    for (const marker of merged) {
      if (result.length === 0 || marker.position - lastPos >= minGap) {
        result.push(marker);
        lastPos = marker.position;
      } else if (marker.type === "year") {
        // Year always wins over a close month
        const prev = result[result.length - 1];
        if (prev && prev.type === "month") {
          result[result.length - 1] = marker;
          lastPos = marker.position;
        }
      }
    }

    return result;
  }, [props.markers]);

  const showMagnifier = (isHovering || isDragging) && hoverState;

  return (
    <div className="flex h-full gap-3">
      {/* Rail + dots — acts as a drag-scrollbar */}
      <div
        className="relative cursor-grab select-none active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        ref={railRef}
        role="presentation"
        style={{ width: 16 }}
      >
        <div className="timeline-rail mx-auto" style={{ height: "100%" }} />
        {props.markers.map((marker) => (
          <button
            aria-label={`${marker.label} — ${marker.photoCount}`}
            className={
              marker.type === "year"
                ? "timeline-year-dot"
                : marker.type === "month"
                  ? "timeline-month-dot"
                  : "timeline-day-dot"
            }
            key={marker.key}
            onClick={(e) => {
              e.stopPropagation();
              document
                .getElementById(buildDaySectionId(marker.scrollToDayKey))
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            style={{ top: `${(marker.position * 100).toFixed(2)}%` }}
            type="button"
          />
        ))}

        {/* Magnifier tooltip — oval pill that follows cursor */}
        <div
          className={`timeline-magnifier ${showMagnifier ? "timeline-magnifier-visible" : ""}`}
          style={{ top: hoverState?.topPx ?? 0 }}
        >
          {hoverState?.label}
        </div>
      </div>

      {/* Labels column */}
      <div className="relative min-w-0 flex-1">
        {visibleLabels.map((marker) => (
          <button
            className={`absolute left-0 -translate-y-1/2 text-left ${
              marker.type === "year"
                ? "text-xs font-semibold text-[var(--color-text)]"
                : "text-[0.6875rem] text-[var(--color-text-muted)]"
            }`}
            key={marker.key}
            onClick={() => {
              document
                .getElementById(buildDaySectionId(marker.scrollToDayKey))
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            style={{ top: `${(marker.position * 100).toFixed(2)}%` }}
            type="button"
          >
            {marker.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function formatDayLabel(dayKey: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dayKey}T00:00:00Z`));
}

function LibraryPhotoTile(props: {
  photo: PhotoDto;
  isFavorite: boolean;
  isFavoriteBusy: boolean;
  isDeleteBusy: boolean;
  onFavoriteToggle: () => void;
}) {
  const { t } = useI18n();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    getPhotoBlob(props.photo.id, "THUMB_SM")
      .then((blob) => {
        if (cancelled) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewUrl(null);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [props.photo.id]);

  const capturedAt = props.photo.takenAt ?? props.photo.createdAt;

  return (
    <div className="group overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <Link
        aria-label={t("app.library.photoTileAria", {
          fileName: props.photo.originalFilename,
        })}
        className="block"
        to={`/app/library/photos/${props.photo.id}`}
      >
        <div className="preview-frame relative aspect-[4/3] overflow-hidden border-0">
          {previewUrl ? (
            <img
              alt={t("app.library.photoPreviewAlt", {
                fileName: props.photo.originalFilename,
              })}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
              src={previewUrl}
            />
          ) : (
            <div className="preview-placeholder flex h-full items-center justify-center">
              <span className="text-xs text-[var(--color-text-muted)]">
                {props.photo.originalFilename}
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="space-y-1.5 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <Link
            className="min-w-0 truncate text-sm font-medium"
            to={`/app/library/photos/${props.photo.id}`}
          >
            {props.photo.originalFilename}
          </Link>
          <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
            {capturedAt.slice(11, 16)}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            aria-label={
              props.isFavorite
                ? t("app.library.removePhotoFavoriteAria", {
                    fileName: props.photo.originalFilename,
                  })
                : t("app.library.addPhotoFavoriteAria", {
                    fileName: props.photo.originalFilename,
                  })
            }
            className="link-accent font-medium"
            disabled={props.isFavoriteBusy}
            onClick={props.onFavoriteToggle}
            type="button"
          >
            {props.isFavoriteBusy
              ? t("common.updating")
              : props.isFavorite
                ? t("common.unfavorite")
                : t("common.favorite")}
          </button>
          <button
            className="text-link-danger font-medium"
            disabled={props.isDeleteBusy}
            form={`delete-photo-${props.photo.id}`}
            type="submit"
          >
            {props.isDeleteBusy ? t("common.deleting") : t("common.delete")}
          </button>
          <Form id={`delete-photo-${props.photo.id}`} method="post">
            <input name="intent" type="hidden" value="delete-photo" />
            <input name="photoId" type="hidden" value={props.photo.id} />
          </Form>
        </div>
      </div>
    </div>
  );
}

async function loadLibraryData(): Promise<LibraryLoaderData> {
  const [photos, albumList, photoFavoriteList, albumFavoriteList] =
    await Promise.all([
      listAllPhotos(),
      listAlbums(),
      listFavorites("PHOTO"),
      listFavorites("ALBUM"),
    ]);

  const albumPages = await Promise.all(
    albumList.map(async (album) => {
      const items = await listAllAlbumPhotos(album.id);
      return {
        ...album,
        photos: items,
      } satisfies AlbumWithPhotos;
    }),
  );

  return {
    photos,
    albums: albumPages,
    photoFavorites: Object.fromEntries(
      photoFavoriteList.map((favorite) => [favorite.targetId, favorite]),
    ),
    albumFavorites: Object.fromEntries(
      albumFavoriteList.map((favorite) => [favorite.targetId, favorite]),
    ),
  };
}

export async function clientLoader() {
  return loadLibraryData();
}

export async function clientAction({
  request,
}: Route.ClientActionArgs): Promise<LibraryActionResult> {
  const formData = await request.formData();
  const intent = resolveActionIntent(
    String(formData.get("intent") ?? ""),
    [
      "delete-photo",
      "create-album",
      "update-album",
      "delete-album",
      "add-photo-to-album",
      "remove-photo-from-album",
    ] as const,
    "create-album",
  );

  try {
    switch (intent) {
      case "delete-photo":
        await deletePhoto(String(formData.get("photoId") ?? ""));
        return { ok: true, intent };
      case "create-album":
        await createAlbum({
          name: String(formData.get("name") ?? "").trim(),
          description: String(formData.get("description") ?? "").trim(),
        });
        return { ok: true, intent };
      case "update-album": {
        const albumId = String(formData.get("albumId") ?? "");
        await updateAlbum(albumId, {
          name: String(formData.get("name") ?? "").trim(),
          description: String(formData.get("description") ?? "").trim(),
        });
        return { ok: true, intent, albumId };
      }
      case "delete-album": {
        const albumId = String(formData.get("albumId") ?? "");
        await deleteAlbum(albumId);
        return { ok: true, intent, albumId };
      }
      case "add-photo-to-album": {
        const albumId = String(formData.get("albumId") ?? "");
        await addPhotoToAlbum(albumId, String(formData.get("photoId") ?? ""));
        return { ok: true, intent, albumId };
      }
      case "remove-photo-from-album": {
        const albumId = String(formData.get("albumId") ?? "");
        await removePhotoFromAlbum(
          albumId,
          String(formData.get("photoId") ?? ""),
        );
        return { ok: true, intent, albumId };
      }
      default:
        return {
          ok: false,
          intent: "create-album",
          errorMessage: translateMessage(
            getActiveLocale(),
            "app.library.actionUnknown",
          ),
        };
    }
  } catch (error) {
    return {
      ok: false,
      intent,
      errorMessage: toActionErrorMessage(
        error,
        translateMessage(getActiveLocale(), "app.library.actionFailed"),
      ),
    };
  }
}

export default function AppLibraryRoute({ loaderData }: Route.ComponentProps) {
  const { locale, t } = useI18n();
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();
  const [photos, setPhotos] = useState<PhotoDto[]>(loaderData.photos);
  const [albums, setAlbums] = useState<AlbumWithPhotos[]>(loaderData.albums);
  const [photoFavorites, setPhotoFavorites] = useState<
    Record<string, FavoriteDto>
  >(loaderData.photoFavorites);
  const [albumFavorites, setAlbumFavorites] = useState<
    Record<string, FavoriteDto>
  >(loaderData.albumFavorites);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isUploadTargetActive, setIsUploadTargetActive] = useState(false);
  const [uploadProgress, setUploadProgress] =
    useState<UploadProgressState | null>(null);
  const [favoriteBusyKey, setFavoriteBusyKey] = useState<string | null>(null);
  const [albumActionError, setAlbumActionError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<
    string | null
  >(null);
  const [libraryFilter, setLibraryFilter] = useState(
    searchParams.get("filter") ?? "",
  );
  const [libraryView, setLibraryView] = useState<LibraryView>(
    resolveLibraryView(searchParams.get("view")),
  );
  const [albumDraft, setAlbumDraft] = useState({
    name: "",
    description: "",
  });
  const [albumEditorDrafts, setAlbumEditorDrafts] = useState<
    Record<string, { name: string; description: string }>
  >(buildAlbumEditorDrafts(loaderData.albums));
  const [albumPhotoSelection, setAlbumPhotoSelection] = useState<
    Record<string, string>
  >(buildAlbumPhotoSelection(loaderData.albums));
  const [geoMapState, setGeoMapState] = useState<GeoMapState>({
    items: [],
    loading: false,
    errorMessage: null,
  });
  const [selectedGeoTarget, setSelectedGeoTarget] =
    useState<GeoSelectionTarget | null>(null);

  const pendingIntent = String(navigation.formData?.get("intent") ?? "");
  const pendingAlbumId = String(navigation.formData?.get("albumId") ?? "");
  const pendingPhotoId = String(navigation.formData?.get("photoId") ?? "");
  const geoViewport = useMemo(
    () => parseGeoViewportFromSearchParams(searchParams),
    [searchParams],
  );
  const deferredGeoViewport = useDeferredValue(geoViewport);
  const normalizedLibraryFilter = libraryFilter.trim().toLowerCase();
  const filteredPhotos = useMemo(
    () =>
      photos.filter((photo) => {
        if (normalizedLibraryFilter.length === 0) {
          return true;
        }
        return (
          photo.originalFilename
            .toLowerCase()
            .includes(normalizedLibraryFilter) ||
          photo.mimeType.toLowerCase().includes(normalizedLibraryFilter)
        );
      }),
    [normalizedLibraryFilter, photos],
  );
  const filteredAlbums = useMemo(
    () =>
      albums.filter((album) => {
        if (normalizedLibraryFilter.length === 0) {
          return true;
        }
        return (
          album.name.toLowerCase().includes(normalizedLibraryFilter) ||
          (album.description ?? "")
            .toLowerCase()
            .includes(normalizedLibraryFilter)
        );
      }),
    [albums, normalizedLibraryFilter],
  );
  const filteredGeoItems = useMemo(
    () =>
      geoMapState.items.filter((photo) => {
        if (normalizedLibraryFilter.length === 0) {
          return true;
        }
        return (
          photo.originalFilename
            .toLowerCase()
            .includes(normalizedLibraryFilter) ||
          photo.mimeType.toLowerCase().includes(normalizedLibraryFilter)
        );
      }),
    [geoMapState.items, normalizedLibraryFilter],
  );

  const unassignedPhotosByAlbum = useMemo(() => {
    return Object.fromEntries(
      filteredAlbums.map((album) => [
        album.id,
        photos.filter(
          (photo) =>
            !album.photos.some((albumPhoto) => albumPhoto.id === photo.id),
        ),
      ]),
    ) as Record<string, PhotoDto[]>;
  }, [filteredAlbums, photos]);

  const timelineGroups = useMemo<TimelineGroup[]>(() => {
    const groups = new Map<string, PhotoDto[]>();

    for (const photo of filteredPhotos) {
      const dayKey = dayKeyForPhoto(photo);
      const bucket = groups.get(dayKey);
      if (bucket) {
        bucket.push(photo);
      } else {
        groups.set(dayKey, [photo]);
      }
    }

    return Array.from(groups.entries())
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([dayKey, groupPhotos]) => ({
        dayKey,
        photos: groupPhotos.sort((left, right) => {
          const leftDate = left.takenAt ?? left.createdAt;
          const rightDate = right.takenAt ?? right.createdAt;
          return rightDate.localeCompare(leftDate);
        }),
      }));
  }, [filteredPhotos]);
  const timelineMarkers = useMemo(
    () => buildProportionalTimeline(timelineGroups, locale),
    [timelineGroups, locale],
  );
  const geoTaggedPhotoCount = useMemo(
    () =>
      photos.filter(
        (photo) => photo.latitude != null && photo.longitude != null,
      ).length,
    [photos],
  );
  const geoClusters = useMemo(
    () => buildGeoClusters(filteredGeoItems, geoViewport),
    [filteredGeoItems, geoViewport],
  );
  const selectedGeoCluster = useMemo(() => {
    if (selectedGeoTarget?.kind !== "cluster") {
      return null;
    }

    return (
      geoClusters.find((cluster) => cluster.id === selectedGeoTarget.id) ?? null
    );
  }, [geoClusters, selectedGeoTarget]);
  const selectedGeoPhoto = useMemo(() => {
    if (selectedGeoTarget?.kind === "photo") {
      return (
        filteredGeoItems.find((photo) => photo.id === selectedGeoTarget.id) ??
        null
      );
    }

    if (selectedGeoCluster?.photos.length === 1) {
      return selectedGeoCluster.photos[0] ?? null;
    }

    return null;
  }, [filteredGeoItems, selectedGeoCluster, selectedGeoTarget]);
  const selectedGeoClusterPhotos = selectedGeoCluster?.photos ?? [];
  const countFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const photoForms = {
    one: t("unit.photo.one"),
    few: t("unit.photo.few"),
    many: t("unit.photo.many"),
    other: t("unit.photo.other"),
  };
  const dayGroupForms = {
    one: t("unit.dayGroup.one"),
    few: t("unit.dayGroup.few"),
    many: t("unit.dayGroup.many"),
    other: t("unit.dayGroup.other"),
  };
  const geoPhotoForms = {
    one: t("unit.geoPhoto.one"),
    few: t("unit.geoPhoto.few"),
    many: t("unit.geoPhoto.many"),
    other: t("unit.geoPhoto.other"),
  };

  useEffect(() => {
    setLibraryView(resolveLibraryView(searchParams.get("view")));
    setLibraryFilter(searchParams.get("filter") ?? "");
  }, [searchParams]);

  useEffect(() => {
    startTransition(() => {
      setPhotos(loaderData.photos);
      setAlbums(loaderData.albums);
      setPhotoFavorites(loaderData.photoFavorites);
      setAlbumFavorites(loaderData.albumFavorites);
      setAlbumEditorDrafts(buildAlbumEditorDrafts(loaderData.albums));
      setAlbumPhotoSelection(buildAlbumPhotoSelection(loaderData.albums));
    });
  }, [loaderData]);

  useEffect(() => {
    if (libraryView !== "map") {
      return;
    }

    let cancelled = false;
    setGeoMapState((current) => ({
      items: current.items,
      loading: true,
      errorMessage: null,
    }));

    void listGeoPhotos({
      ...deferredGeoViewport,
      page: 0,
      size: 100,
      needsTotal: true,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setGeoMapState({
            items: response.items,
            loading: false,
            errorMessage: null,
          });
          setSelectedGeoTarget((current) => {
            if (
              current?.kind === "photo" &&
              response.items.some((photo) => photo.id === current.id)
            ) {
              return current;
            }
            return response.items[0]
              ? {
                  id: response.items[0].id,
                  kind: "photo",
                }
              : null;
          });
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setGeoMapState({
          items: [],
          loading: false,
          errorMessage:
            error instanceof Error
              ? error.message
              : t("app.library.mapLoadFailed"),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [deferredGeoViewport, libraryView, t]);

  useEffect(() => {
    if (libraryView !== "map") {
      return;
    }

    setSelectedGeoTarget((current) => {
      if (current == null) {
        return null;
      }

      if (current?.kind === "photo") {
        if (filteredGeoItems.some((photo) => photo.id === current.id)) {
          return current;
        }
      } else if (current?.kind === "cluster") {
        if (geoClusters.some((cluster) => cluster.id === current.id)) {
          return current;
        }
      }

      return null;
    });
  }, [filteredGeoItems, geoClusters, libraryView]);

  useEffect(() => {
    if (!actionData) {
      return;
    }

    if (actionData.ok) {
      setAlbumActionError(null);
      setUploadError(null);
      setUploadSuccessMessage(null);
      if (actionData.intent === "create-album") {
        setAlbumDraft({ name: "", description: "" });
      }
      if (actionData.albumId) {
        setAlbumPhotoSelection((current) => ({
          ...current,
          [actionData.albumId!]: "",
        }));
      }
      revalidator.revalidate();
      return;
    }

    if (actionData.intent === "delete-photo") {
      setUploadError(actionData.errorMessage);
      return;
    }

    setAlbumActionError(actionData.errorMessage);
  }, [actionData, revalidator]);

  async function reloadLibrary() {
    try {
      setErrorMessage(null);
      const nextData = await loadLibraryData();

      startTransition(() => {
        setPhotos(nextData.photos);
        setAlbums(nextData.albums);
        setPhotoFavorites(nextData.photoFavorites);
        setAlbumFavorites(nextData.albumFavorites);
        setAlbumEditorDrafts(
          Object.fromEntries(
            nextData.albums.map((album) => [
              album.id,
              {
                name: album.name,
                description: album.description ?? "",
              },
            ]),
          ),
        );
        setAlbumPhotoSelection(
          Object.fromEntries(nextData.albums.map((album) => [album.id, ""])),
        );
      });
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : t("app.library.loadFailed"),
      );
    }
  }

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) {
      return;
    }

    await uploadSelectedFiles(files);
    event.target.value = "";
  }

  async function uploadSelectedFiles(files: File[]) {
    const supportedFiles = getSupportedUploadFiles(files);
    if (supportedFiles.length === 0) {
      setUploadError(t("app.library.uploadTypeError"));
      setUploadSuccessMessage(null);
      return;
    }

    setUploadingPhoto(true);
    setUploadError(null);
    setUploadSuccessMessage(null);
    setUploadProgress({
      total: supportedFiles.length,
      completed: 0,
      currentFileName: supportedFiles[0]?.name ?? null,
    });

    let uploadedCount = 0;
    const failedUploads: string[] = [];

    try {
      for (const [index, file] of supportedFiles.entries()) {
        setUploadProgress({
          total: supportedFiles.length,
          completed: uploadedCount,
          currentFileName: file.name,
        });

        try {
          await uploadPhoto(file);
          uploadedCount += 1;
        } catch (error) {
          failedUploads.push(
            error instanceof ApiError
              ? `${file.name}: ${error.message}`
              : t("app.library.uploadFileFailed", {
                  fileName: file.name,
                }),
          );
        }

        setUploadProgress({
          total: supportedFiles.length,
          completed: uploadedCount,
          currentFileName:
            index < supportedFiles.length - 1
              ? supportedFiles[index + 1]!.name
              : null,
        });
      }

      if (uploadedCount > 0) {
        await reloadLibrary();
        setUploadSuccessMessage(
          formatUploadSummary(uploadedCount, supportedFiles.length, locale),
        );
      }

      if (failedUploads.length > 0) {
        setUploadError(failedUploads.join(" "));
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setUploadError(error.message);
      } else {
        setUploadError(t("app.library.uploadFailed"));
      }
    } finally {
      setUploadingPhoto(false);
      setUploadProgress(null);
    }
  }

  async function handlePhotoFavoriteToggle(photoId: string) {
    const favorite = photoFavorites[photoId];
    setFavoriteBusyKey(`photo:${photoId}`);

    try {
      if (favorite) {
        await removeFavorite(favorite.id);
      } else {
        await addFavorite("PHOTO", photoId);
      }
      await reloadLibrary();
    } catch (error) {
      if (error instanceof ApiError) {
        setAlbumActionError(error.message);
      } else {
        setAlbumActionError(t("app.library.photoFavoriteFailed"));
      }
    } finally {
      setFavoriteBusyKey(null);
    }
  }

  async function handleAlbumFavoriteToggle(albumId: string) {
    const favorite = albumFavorites[albumId];
    setFavoriteBusyKey(`album:${albumId}`);

    try {
      if (favorite) {
        await removeFavorite(favorite.id);
      } else {
        await addFavorite("ALBUM", albumId);
      }
      await reloadLibrary();
    } catch (error) {
      if (error instanceof ApiError) {
        setAlbumActionError(error.message);
      } else {
        setAlbumActionError(t("app.library.albumFavoriteFailed"));
      }
    } finally {
      setFavoriteBusyKey(null);
    }
  }

  function updateAlbumDraft(
    albumId: string,
    field: "name" | "description",
    value: string,
  ) {
    setAlbumEditorDrafts((current) => ({
      ...current,
      [albumId]: {
        name: current[albumId]?.name ?? "",
        description: current[albumId]?.description ?? "",
        [field]: value,
      },
    }));
  }

  function setMapViewport(nextViewport: PhotoGeoBounds) {
    const nextParams = applyGeoViewportToSearchParams(
      searchParams,
      nextViewport,
    );
    nextParams.set("view", "map");
    setSearchParams(nextParams, { replace: true });
  }

  function activateLibraryView(nextView: LibraryView) {
    setLibraryView(nextView);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("view", nextView);

    if (nextView === "map") {
      const seededParams = applyGeoViewportToSearchParams(
        nextParams,
        geoViewport,
      );
      setSearchParams(seededParams, { replace: true });
      return;
    }

    setSearchParams(nextParams, { replace: true });
  }

  function updateLibraryFilter(value: string) {
    setLibraryFilter(value);
    const nextParams = new URLSearchParams(searchParams);
    if (value.trim().length === 0) {
      nextParams.delete("filter");
    } else {
      nextParams.set("filter", value);
    }
    setSearchParams(nextParams, { replace: true });
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-4 -mt-4 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 sm:-mx-6 sm:-mt-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {[
              { id: "photos", label: t("app.library.view.photos") },
              { id: "timeline", label: t("app.library.view.timeline") },
              { id: "map", label: t("app.library.view.map") },
              { id: "albums", label: t("app.library.view.albums") },
            ].map((option) => (
              <button
                aria-pressed={libraryView === option.id}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  libraryView === option.id
                    ? "bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]"
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
                }`}
                key={option.id}
                onClick={() => activateLibraryView(option.id as LibraryView)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <input
              aria-label={t("app.library.filterLabel")}
              className="field w-48 py-1.5 text-sm lg:w-64"
              onChange={(event) => updateLibraryFilter(event.target.value)}
              placeholder={t("app.library.filterPlaceholder")}
              type="search"
              value={libraryFilter}
            />
            {libraryView !== "map" ? (
              <label className="button-primary cursor-pointer py-1.5 text-sm">
                <input
                  accept="image/jpeg,image/png"
                  aria-label={t("app.library.uploadPhotos")}
                  className="hidden"
                  disabled={uploadingPhoto}
                  multiple
                  onChange={handlePhotoUpload}
                  type="file"
                />
                {uploadingPhoto
                  ? t("app.library.uploadingPhotos")
                  : t("app.library.uploadPhotos")}
              </label>
            ) : null}
          </div>
        </div>
      </div>

      {errorMessage ? (
        <Panel className="p-4">
          <p className="alert-danger">{errorMessage}</p>
        </Panel>
      ) : null}

      <section
        className={`grid gap-6 ${
          libraryView === "albums"
            ? "xl:grid-cols-[1.05fr_0.95fr]"
            : libraryView === "map"
              ? ""
              : "xl:grid-cols-[minmax(0,1fr)_15rem]"
        }`}
      >
        {(libraryView === "photos" ||
          libraryView === "timeline" ||
          libraryView === "map") && (
          <div>
            {libraryView === "map" ? (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-sm text-[var(--color-text-muted)]">
                  {countFormatter.format(filteredGeoItems.length)}{" "}
                  {formatRelativeCount(filteredGeoItems.length, geoPhotoForms)}
                </span>
                <div className="ml-auto flex flex-wrap gap-1">
                  <button
                    className="button-secondary py-1 text-sm"
                    disabled={selectedGeoTarget == null}
                    onClick={() => setSelectedGeoTarget(null)}
                    type="button"
                  >
                    {t("app.library.clearSelection")}
                  </button>
                  <button
                    className="button-secondary py-1 text-sm"
                    onClick={() => setMapViewport(DEFAULT_GEO_VIEWPORT)}
                    type="button"
                  >
                    {t("app.library.worldView")}
                  </button>
                  <button
                    className="button-secondary py-1 text-sm"
                    onClick={() =>
                      setMapViewport(zoomGeoViewport(geoViewport, "in"))
                    }
                    type="button"
                  >
                    {t("app.library.zoomIn")}
                  </button>
                  <button
                    className="button-secondary py-1 text-sm"
                    onClick={() =>
                      setMapViewport(zoomGeoViewport(geoViewport, "out"))
                    }
                    type="button"
                  >
                    {t("app.library.zoomOut")}
                  </button>
                </div>
              </div>
            ) : null}

            {libraryView === "map" ? (
              <>
                <div className="grid gap-3 lg:grid-cols-[0.72fr_0.28fr]">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        className="button-secondary py-1 text-sm"
                        onClick={() =>
                          setMapViewport(panGeoViewport(geoViewport, "west"))
                        }
                        type="button"
                      >
                        {t("app.library.panWest")}
                      </button>
                      <button
                        className="button-secondary py-1 text-sm"
                        onClick={() =>
                          setMapViewport(panGeoViewport(geoViewport, "east"))
                        }
                        type="button"
                      >
                        {t("app.library.panEast")}
                      </button>
                      <button
                        className="button-secondary py-1 text-sm"
                        onClick={() =>
                          setMapViewport(panGeoViewport(geoViewport, "north"))
                        }
                        type="button"
                      >
                        {t("app.library.panNorth")}
                      </button>
                      <button
                        className="button-secondary py-1 text-sm"
                        onClick={() =>
                          setMapViewport(panGeoViewport(geoViewport, "south"))
                        }
                        type="button"
                      >
                        {t("app.library.panSouth")}
                      </button>
                    </div>
                    <div className="map-shell rounded-lg p-2">
                      <div className="map-canvas relative min-h-[28rem] overflow-hidden rounded-[1.25rem]">
                        {geoMapState.loading ? (
                          <div className="map-overlay absolute inset-0 flex items-center justify-center text-sm font-semibold">
                            {t("app.library.loadingMarkers")}
                          </div>
                        ) : null}
                        {geoClusters.map((cluster) => {
                          const isCluster = cluster.photos.length > 1;
                          const leadPhoto = cluster.photos[0];
                          const isSelected = isCluster
                            ? selectedGeoTarget?.kind === "cluster" &&
                              selectedGeoTarget.id === cluster.id
                            : selectedGeoTarget?.kind === "photo" &&
                              selectedGeoTarget.id === leadPhoto?.id;

                          if (!leadPhoto) {
                            return null;
                          }

                          return (
                            <button
                              aria-label={
                                isCluster
                                  ? t("app.library.openClusterAria", {
                                      count: countFormatter.format(
                                        cluster.photos.length,
                                      ),
                                    })
                                  : t("app.library.openMarkerAria", {
                                      fileName: leadPhoto.originalFilename,
                                    })
                              }
                              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm transition ${
                                isCluster
                                  ? "min-h-8 min-w-8 px-2 text-xs font-semibold"
                                  : "h-4 w-4"
                              } ${
                                isSelected
                                  ? "bg-[var(--color-primary-strong)] text-white ring-4 ring-[var(--map-selected-ring)]"
                                  : "bg-[var(--color-accent-strong)] text-[var(--color-text)] hover:bg-[var(--color-primary-strong)] hover:text-white"
                              }`}
                              key={cluster.id}
                              onClick={() => {
                                if (isCluster) {
                                  setSelectedGeoTarget({
                                    id: cluster.id,
                                    kind: "cluster",
                                  });
                                  return;
                                }

                                setSelectedGeoTarget({
                                  id: leadPhoto.id,
                                  kind: "photo",
                                });
                              }}
                              style={{
                                left: `${cluster.position.left}%`,
                                top: `${cluster.position.top}%`,
                              }}
                              type="button"
                            >
                              {isCluster ? cluster.photos.length : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <dl className="space-y-1 text-xs text-[var(--color-text-muted)]">
                      <div className="flex justify-between gap-4">
                        <dt>{t("app.library.viewportMarkers")}</dt>
                        <dd>{geoClusters.length}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>{t("app.library.viewportPhotosInView")}</dt>
                        <dd>{filteredGeoItems.length}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>{t("app.library.viewportSelection")}</dt>
                        <dd>
                          {selectedGeoCluster &&
                          selectedGeoCluster.photos.length > 1
                            ? t("app.library.selectionCluster", {
                                count: countFormatter.format(
                                  selectedGeoCluster.photos.length,
                                ),
                              })
                            : selectedGeoPhoto
                              ? t("app.library.selectionSinglePhoto")
                              : t("app.library.selectionNone")}
                        </dd>
                      </div>
                    </dl>

                    {geoMapState.errorMessage ? (
                      <InlineMessage className="mt-4" tone="danger">
                        {geoMapState.errorMessage}
                      </InlineMessage>
                    ) : null}

                    {selectedGeoCluster &&
                    selectedGeoCluster.photos.length > 1 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">
                          {t("app.library.clusterTitle", {
                            count: countFormatter.format(
                              selectedGeoCluster.photos.length,
                            ),
                          })}
                        </p>
                        <button
                          className="button-secondary w-full py-1 text-sm"
                          onClick={() =>
                            setMapViewport(
                              zoomToClusterBounds(selectedGeoCluster.bounds),
                            )
                          }
                          type="button"
                        >
                          {t("app.library.zoomIntoCluster")}
                        </button>
                        <div className="space-y-1">
                          {selectedGeoClusterPhotos.slice(0, 6).map((photo) => (
                            <button
                              className="flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-left text-sm hover:border-[var(--color-accent-strong)]"
                              key={photo.id}
                              onClick={() =>
                                setSelectedGeoTarget({
                                  id: photo.id,
                                  kind: "photo",
                                })
                              }
                              type="button"
                            >
                              <span className="font-medium text-[var(--color-text)]">
                                {photo.originalFilename}
                              </span>
                              <span className="text-xs text-[var(--color-text-muted)]">
                                {formatCoordinate(photo.latitude)},{" "}
                                {formatCoordinate(photo.longitude)}
                              </span>
                            </button>
                          ))}
                        </div>
                        {selectedGeoClusterPhotos.length > 6 ? (
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {t("app.library.clusterMore", {
                              count: countFormatter.format(
                                selectedGeoClusterPhotos.length - 6,
                              ),
                            })}
                          </p>
                        ) : null}
                      </div>
                    ) : selectedGeoPhoto ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">
                          {selectedGeoPhoto.originalFilename}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {t("app.library.photoSelected")} ·{" "}
                          {formatCoordinate(selectedGeoPhoto.latitude)},{" "}
                          {formatCoordinate(selectedGeoPhoto.longitude)}
                        </p>
                        <Link
                          className="button-secondary inline-flex py-1 text-sm"
                          to={`/app/library/photos/${selectedGeoPhoto.id}`}
                        >
                          {t("app.library.openPhotoDetail")}
                        </Link>
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {geoMapState.loading
                          ? t("app.library.loadingViewport")
                          : t("app.library.selectMarkerHint")}
                      </p>
                    )}
                  </div>
                </div>

                {!geoMapState.loading &&
                filteredGeoItems.length === 0 &&
                !geoMapState.errorMessage ? (
                  <div className="mt-4">
                    <EmptyState
                      action={
                        <div className="flex flex-wrap justify-center gap-3">
                          {normalizedLibraryFilter.length > 0 ? (
                            <button
                              className="button-secondary"
                              onClick={() => updateLibraryFilter("")}
                              type="button"
                            >
                              {t("common.clearFilter")}
                            </button>
                          ) : null}
                          <button
                            className="button-secondary"
                            onClick={() => setMapViewport(DEFAULT_GEO_VIEWPORT)}
                            type="button"
                          >
                            {t("app.library.resetWorldView")}
                          </button>
                        </div>
                      }
                      description={
                        geoTaggedPhotoCount === 0
                          ? t("app.library.noGeoPhotosDescription")
                          : normalizedLibraryFilter.length > 0
                            ? t("app.library.noGeoPhotosMatchDescription", {
                                filter: libraryFilter,
                              })
                            : t("app.library.noGeoPhotosViewportDescription")
                      }
                      title={
                        geoTaggedPhotoCount === 0
                          ? t("app.library.noGeoPhotosTitle")
                          : normalizedLibraryFilter.length > 0
                            ? t("app.library.noGeoPhotosMatchTitle")
                            : t("app.library.noGeoPhotosViewportTitle")
                      }
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div
                  className={`surface-dashed rounded-lg px-4 py-3 text-center transition ${
                    isUploadTargetActive
                      ? "dropzone-active"
                      : "bg-[var(--color-panel)]"
                  }`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsUploadTargetActive(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    if (
                      event.currentTarget.contains(
                        event.relatedTarget as Node | null,
                      )
                    ) {
                      return;
                    }
                    setIsUploadTargetActive(false);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsUploadTargetActive(true);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsUploadTargetActive(false);
                    void uploadSelectedFiles(
                      Array.from(event.dataTransfer.files),
                    );
                  }}
                >
                  {uploadProgress ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate text-sm font-medium text-[var(--color-text)]">
                          {uploadProgress.currentFileName ??
                            t("app.library.uploadingPhotos")}
                        </p>
                        <span className="shrink-0 text-xs tabular-nums text-[var(--color-text-muted)]">
                          {countFormatter.format(uploadProgress.completed)}/
                          {countFormatter.format(uploadProgress.total)}
                        </span>
                      </div>
                      <div className="upload-progress-track">
                        <div
                          className="upload-progress-bar"
                          style={{
                            width: `${Math.round((uploadProgress.completed / uploadProgress.total) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {t("app.library.dropzoneTitle")}
                    </p>
                  )}
                </div>

                {uploadError ? (
                  <InlineMessage className="mt-2" tone="danger">
                    {uploadError}
                  </InlineMessage>
                ) : null}

                {uploadSuccessMessage ? (
                  <InlineMessage className="mt-2" tone="success">
                    {uploadSuccessMessage}
                  </InlineMessage>
                ) : null}
              </>
            )}

            {photos.length === 0 ? (
              <EmptyState
                description={t("app.library.noPhotosDescription")}
                title={t("app.library.noPhotosTitle")}
              />
            ) : libraryView === "map" ? null : filteredPhotos.length === 0 ? (
              <EmptyState
                description={t("app.library.noPhotosMatchDescription")}
                title={t("app.library.noPhotosMatchTitle")}
              />
            ) : (
              <div className="space-y-6" id="library-photo-grid">
                {timelineGroups.map((group) => (
                  <section
                    className="scroll-mt-16"
                    id={buildDaySectionId(group.dayKey)}
                    key={group.dayKey}
                  >
                    <div className="flex items-baseline justify-between gap-3 pb-2">
                      <h3 className="text-sm font-semibold">
                        {formatDayLabel(group.dayKey, locale)}
                      </h3>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {formatRelativeCount(group.photos.length, photoForms)}
                      </span>
                    </div>

                    <div
                      className={`grid gap-3 ${
                        libraryView === "timeline"
                          ? "sm:grid-cols-2 xl:grid-cols-3"
                          : "sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                      }`}
                    >
                      {group.photos.map((photo) => (
                        <LibraryPhotoTile
                          isDeleteBusy={
                            pendingIntent === "delete-photo" &&
                            pendingPhotoId === photo.id
                          }
                          isFavorite={Boolean(photoFavorites[photo.id])}
                          isFavoriteBusy={
                            favoriteBusyKey === `photo:${photo.id}`
                          }
                          key={photo.id}
                          onFavoriteToggle={() => {
                            void handlePhotoFavoriteToggle(photo.id);
                          }}
                          photo={photo}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}

        {(libraryView === "photos" || libraryView === "timeline") && (
          <div className="xl:sticky xl:self-start" style={{ top: "3.5rem" }}>
            <div style={{ height: "calc(100vh - 6rem)" }}>
              <ProportionalTimelineRail
                dayGroupForms={dayGroupForms}
                locale={locale}
                markers={timelineMarkers}
                photoForms={photoForms}
                timelineGroups={timelineGroups}
                totalDays={timelineGroups.length}
                totalPhotos={filteredPhotos.length}
              />
            </div>
            <div className="mt-2 text-xs text-[var(--color-text-muted)]">
              {countFormatter.format(filteredPhotos.length)}{" "}
              {formatRelativeCount(filteredPhotos.length, photoForms)} ·{" "}
              {countFormatter.format(timelineGroups.length)}{" "}
              {formatRelativeCount(timelineGroups.length, dayGroupForms)}
            </div>
          </div>
        )}

        {libraryView === "albums" && (
          <div className="space-y-4">
            <Panel className="p-4">
              <h2 className="text-sm font-semibold">
                {t("app.library.createAlbumTitle")}
              </h2>
              <Form className="mt-3 space-y-3" method="post">
                <input name="intent" type="hidden" value="create-album" />
                <label className="block">
                  <span className="mb-2 block text-sm font-medium">
                    {t("common.name")}
                  </span>
                  <input
                    className="field"
                    name="name"
                    onChange={(event) =>
                      setAlbumDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    required
                    value={albumDraft.name}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium">
                    {t("common.description")}
                  </span>
                  <textarea
                    className="field min-h-28 resize-y"
                    name="description"
                    onChange={(event) =>
                      setAlbumDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    value={albumDraft.description}
                  />
                </label>

                {albumActionError ? (
                  <InlineMessage tone="danger">
                    {albumActionError}
                  </InlineMessage>
                ) : null}

                <button
                  className="button-primary w-full"
                  disabled={pendingIntent === "create-album"}
                  type="submit"
                >
                  {pendingIntent === "create-album"
                    ? t("common.creating")
                    : t("app.library.createAlbumSubmit")}
                </button>
              </Form>
            </Panel>

            <div className="flex items-center justify-between">
              <Link
                className="text-sm text-[var(--color-link)] hover:text-[var(--color-link-hover)]"
                to="/app/spaces"
              >
                {t("app.library.openSpaces")}
              </Link>
            </div>

            <Panel className="p-4">
              <h2 className="text-sm font-semibold">
                {t("app.library.albumsTitle")}
              </h2>

              {albums.length === 0 ? (
                <EmptyHint className="mt-6 px-5 py-6 leading-7">
                  {t("app.library.noAlbums")}
                </EmptyHint>
              ) : filteredAlbums.length === 0 ? (
                <EmptyHint className="mt-6 px-5 py-6 leading-7">
                  {t("app.library.noAlbumsMatch")}
                </EmptyHint>
              ) : (
                <div className="mt-3 space-y-3">
                  {filteredAlbums.map((album) => {
                    const draft = albumEditorDrafts[album.id] ?? {
                      name: album.name,
                      description: album.description ?? "",
                    };
                    const availablePhotos =
                      unassignedPhotosByAlbum[album.id] ?? [];

                    return (
                      <SurfaceCard className="rounded-lg p-3" key={album.id}>
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm font-semibold">
                            {album.name}
                          </h3>
                          <div className="flex items-center gap-3">
                            <button
                              aria-label={
                                albumFavorites[album.id]
                                  ? t("app.library.removeAlbumFavoriteAria", {
                                      albumName: album.name,
                                    })
                                  : t("app.library.addAlbumFavoriteAria", {
                                      albumName: album.name,
                                    })
                              }
                              className="link-accent text-sm font-semibold"
                              disabled={favoriteBusyKey === `album:${album.id}`}
                              onClick={() => {
                                void handleAlbumFavoriteToggle(album.id);
                              }}
                              type="button"
                            >
                              {favoriteBusyKey === `album:${album.id}`
                                ? t("common.updating")
                                : albumFavorites[album.id]
                                  ? t("common.unfavorite")
                                  : t("common.favorite")}
                            </button>
                            <button
                              className="text-link-danger text-sm font-semibold"
                              disabled={
                                pendingIntent === "delete-album" &&
                                pendingAlbumId === album.id
                              }
                              form={`delete-album-${album.id}`}
                              type="submit"
                            >
                              {pendingIntent === "delete-album" &&
                              pendingAlbumId === album.id
                                ? t("common.deleting")
                                : t("common.delete")}
                            </button>
                            <Form id={`delete-album-${album.id}`} method="post">
                              <input
                                name="intent"
                                type="hidden"
                                value="delete-album"
                              />
                              <input
                                name="albumId"
                                type="hidden"
                                value={album.id}
                              />
                            </Form>
                          </div>
                        </div>

                        <Form className="mt-4 space-y-3" method="post">
                          <input
                            name="intent"
                            type="hidden"
                            value="update-album"
                          />
                          <input
                            name="albumId"
                            type="hidden"
                            value={album.id}
                          />
                          <input
                            className="field"
                            name="name"
                            onChange={(event) => {
                              updateAlbumDraft(
                                album.id,
                                "name",
                                event.target.value,
                              );
                            }}
                            value={draft.name}
                          />
                          <textarea
                            className="field min-h-24 resize-y"
                            name="description"
                            onChange={(event) => {
                              updateAlbumDraft(
                                album.id,
                                "description",
                                event.target.value,
                              );
                            }}
                            value={draft.description}
                          />
                          <button
                            className="button-secondary w-full"
                            disabled={
                              pendingIntent === "update-album" &&
                              pendingAlbumId === album.id
                            }
                            type="submit"
                          >
                            {pendingIntent === "update-album" &&
                            pendingAlbumId === album.id
                              ? t("common.saving")
                              : t("app.library.saveAlbum")}
                          </button>
                        </Form>

                        <div className="mt-5 space-y-3">
                          <Form className="flex gap-3" method="post">
                            <input
                              name="intent"
                              type="hidden"
                              value="add-photo-to-album"
                            />
                            <input
                              name="albumId"
                              type="hidden"
                              value={album.id}
                            />
                            <select
                              aria-label={t("app.library.photoForAlbumAria", {
                                albumName: album.name,
                              })}
                              className="field"
                              disabled={availablePhotos.length === 0}
                              name="photoId"
                              onChange={(event) =>
                                setAlbumPhotoSelection((current) => ({
                                  ...current,
                                  [album.id]: event.target.value,
                                }))
                              }
                              value={albumPhotoSelection[album.id] ?? ""}
                            >
                              <option value="">
                                {t("app.library.selectPhotoToAdd")}
                              </option>
                              {availablePhotos.map((photo) => (
                                <option key={photo.id} value={photo.id}>
                                  {photo.originalFilename}
                                </option>
                              ))}
                            </select>
                            {availablePhotos.length === 0 ? (
                              <p className="text-sm text-[var(--color-text-muted)]">
                                {t("app.library.allPhotosAssigned")}
                              </p>
                            ) : null}
                            <button
                              className="button-secondary shrink-0"
                              disabled={
                                !albumPhotoSelection[album.id] ||
                                (pendingIntent === "add-photo-to-album" &&
                                  pendingAlbumId === album.id)
                              }
                              type="submit"
                            >
                              {t("common.add")}
                            </button>
                          </Form>

                          {album.photos.length === 0 ? (
                            <p className="text-sm text-[var(--color-text-muted)]">
                              {t("app.library.noPhotosInAlbum")}
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {album.photos.map((photo) => (
                                <div
                                  key={photo.id}
                                  className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] px-3 py-3"
                                >
                                  <div>
                                    <p className="text-sm font-semibold">
                                      {photo.originalFilename}
                                    </p>
                                    <p className="text-xs text-[var(--color-text-muted)]">
                                      {formatBytes(photo.sizeBytes)}
                                    </p>
                                  </div>
                                  <button
                                    className="text-link-danger text-sm font-semibold"
                                    disabled={
                                      pendingIntent ===
                                        "remove-photo-from-album" &&
                                      pendingAlbumId === album.id &&
                                      pendingPhotoId === photo.id
                                    }
                                    form={`remove-photo-${album.id}-${photo.id}`}
                                    type="submit"
                                  >
                                    {t("common.remove")}
                                  </button>
                                  <Form
                                    id={`remove-photo-${album.id}-${photo.id}`}
                                    method="post"
                                  >
                                    <input
                                      name="intent"
                                      type="hidden"
                                      value="remove-photo-from-album"
                                    />
                                    <input
                                      name="albumId"
                                      type="hidden"
                                      value={album.id}
                                    />
                                    <input
                                      name="photoId"
                                      type="hidden"
                                      value={photo.id}
                                    />
                                  </Form>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </SurfaceCard>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>
        )}
      </section>
    </div>
  );
}
