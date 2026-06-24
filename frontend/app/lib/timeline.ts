import type { Locale } from "~/lib/i18n";
import type { PhotoDto } from "~/types/api";

export type TimelineGroup = {
  dayKey: string;
  photos: PhotoDto[];
};

export interface TimelineMarker {
  type: "year" | "month" | "day";
  key: string;
  label: string;
  scrollToDayKey: string;
  photoCount: number;
  position: number;
}

function dayKeyForPhoto(photo: PhotoDto) {
  const value = photo.takenAt ?? photo.createdAt;
  return value.slice(0, 10);
}

export function buildTimelineGroups(photos: PhotoDto[]): TimelineGroup[] {
  const groups = new Map<string, PhotoDto[]>();

  for (const photo of photos) {
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
}

export function buildDaySectionId(dayKey: string) {
  return `library-day-${dayKey}`;
}

export type TimelineZoom = "day" | "month" | "year";

export const TIMELINE_ZOOMS: readonly TimelineZoom[] = ["day", "month", "year"];

export function resolveTimelineZoom(value: string | null): TimelineZoom {
  return value === "month" || value === "year" ? value : "day";
}

/**
 * A timeline group at an arbitrary zoom level. `key` is always a canonical
 * `YYYY-MM-DD` string (the day itself for day-zoom, the 1st of the month for
 * month-zoom, the 1st of January for year-zoom) so groups and the scrubber rail
 * sort and bucket uniformly regardless of zoom.
 */
export interface ZoomTimelineGroup {
  key: string;
  photos: PhotoDto[];
}

function zoomKeyForDay(dayKey: string, zoom: TimelineZoom): string {
  if (zoom === "month") return `${dayKey.slice(0, 7)}-01`;
  if (zoom === "year") return `${dayKey.slice(0, 4)}-01-01`;
  return dayKey;
}

export function buildZoomedTimeline(
  photos: PhotoDto[],
  zoom: TimelineZoom,
): ZoomTimelineGroup[] {
  if (zoom === "day") {
    return buildTimelineGroups(photos).map((group) => ({
      key: group.dayKey,
      photos: group.photos,
    }));
  }

  const groups = new Map<string, PhotoDto[]>();
  for (const photo of photos) {
    const key = zoomKeyForDay(dayKeyForPhoto(photo), zoom);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(photo);
    } else {
      groups.set(key, [photo]);
    }
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([key, groupPhotos]) => ({
      key,
      photos: groupPhotos.sort((left, right) => {
        const leftDate = left.takenAt ?? left.createdAt;
        const rightDate = right.takenAt ?? right.createdAt;
        return rightDate.localeCompare(leftDate);
      }),
    }));
}

/** Localized header label for a zoom group, matching the Photos prototype. */
export function formatZoomGroupLabel(
  key: string,
  zoom: TimelineZoom,
  locale: Locale,
): string {
  const date = new Date(`${key}T00:00:00Z`);
  if (zoom === "year") {
    return String(date.getUTCFullYear());
  }
  if (zoom === "month") {
    const label = new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export interface RailDay {
  groupIdx: number;
  key: string;
  count: number;
}

export interface RailMonth {
  year: number;
  /** 1-12 */
  month: number;
  total: number;
  days: RailDay[];
}

/**
 * Collapse zoom groups into a month-granular index for the scrubber rail:
 * months sorted newest-first, each carrying its day buckets (with the source
 * group index, for scroll-to-jump) and a photo total.
 */
export function buildRailMonths(groups: ZoomTimelineGroup[]): RailMonth[] {
  const months = new Map<string, RailMonth>();
  groups.forEach((group, index) => {
    const year = Number(group.key.slice(0, 4));
    const month = Number(group.key.slice(5, 7));
    const monthKey = `${year}-${month}`;
    let record = months.get(monthKey);
    if (!record) {
      record = { year, month, total: 0, days: [] };
      months.set(monthKey, record);
    }
    record.days.push({
      groupIdx: index,
      key: group.key,
      count: group.photos.length,
    });
    record.total += group.photos.length;
  });

  return Array.from(months.values()).sort(
    (left, right) => right.year - left.year || right.month - left.month,
  );
}

export function formatDayLabel(dayKey: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dayKey}T00:00:00Z`));
}

const DAY_SIGNIFICANCE_THRESHOLD = 0.15;

export function buildProportionalTimeline(
  timelineGroups: TimelineGroup[],
  locale: Locale,
): TimelineMarker[] {
  if (timelineGroups.length === 0) {
    return [];
  }

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

  const totalPhotos = timelineGroups.reduce(
    (sum, group) => sum + group.photos.length,
    0,
  );
  if (totalPhotos === 0) {
    return [];
  }

  const sortedYears = Array.from(yearMap.entries()).sort(([a], [b]) => b - a);

  const markers: TimelineMarker[] = [];
  let cumulativePhotos = 0;

  for (const [year, yearEntry] of sortedYears) {
    const yearPosition = cumulativePhotos / totalPhotos;
    const sortedMonths = Array.from(yearEntry.months.entries()).sort(
      ([a], [b]) => b - a,
    );

    markers.push({
      type: "year",
      key: String(year),
      label: String(year),
      scrollToDayKey:
        sortedMonths[0]?.[1].days.values().next().value?.dayKey ??
        timelineGroups[0]!.dayKey,
      photoCount: yearEntry.count,
      position: yearPosition,
    });

    for (const [month, monthEntry] of sortedMonths) {
      const monthPosition = cumulativePhotos / totalPhotos;
      const date = new Date(Date.UTC(year, month, 1));
      const sortedDays = Array.from(monthEntry.days.values()).sort((a, b) =>
        b.dayKey.localeCompare(a.dayKey),
      );

      markers.push({
        type: "month",
        key: `${year}-${month}`,
        label: date.toLocaleDateString(locale, { month: "short" }),
        scrollToDayKey: sortedDays[0]?.dayKey,
        photoCount: monthEntry.count,
        position: monthPosition,
      });

      for (const dayEntry of sortedDays) {
        if (
          dayEntry.count / monthEntry.count >= DAY_SIGNIFICANCE_THRESHOLD &&
          monthEntry.count > 6
        ) {
          markers.push({
            type: "day",
            key: dayEntry.dayKey,
            label: dayEntry.dayKey.slice(8, 10),
            scrollToDayKey: dayEntry.dayKey,
            photoCount: dayEntry.count,
            position: cumulativePhotos / totalPhotos,
          });
        }
        cumulativePhotos += dayEntry.count;
      }
    }
  }

  if (markers.length > 1) {
    const n = markers.length;
    const positions = markers.map((m) => m.position);
    const gaps = positions
      .slice(1)
      .map((position, i) => position - positions[i]!)
      .filter((gap) => gap > 0);
    const avgGap =
      gaps.length > 0
        ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length
        : 1 / (n - 1);
    const targetGap = 1 / (n - 1);
    if (avgGap < targetGap * 0.75) {
      const t = Math.min(0.35, targetGap - avgGap);
      for (let i = 0; i < n; i++) {
        const uniform = i / (n - 1);
        markers[i]!.position = (1 - t) * markers[i]!.position + t * uniform;
      }
    }
  }

  const pad = 0.04;
  const range = 1 - 2 * pad;
  for (const marker of markers) {
    marker.position = pad + marker.position * range;
  }

  return markers;
}

export function dateAtPosition(
  position: number,
  timelineGroups: TimelineGroup[],
  locale: Locale,
): { label: string; dayKey: string } | null {
  if (timelineGroups.length === 0) {
    return null;
  }

  const totalPhotos = timelineGroups.reduce(
    (sum, group) => sum + group.photos.length,
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
