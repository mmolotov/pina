// Run this whole file in a timezone far west of UTC: every helper here deals
// in calendar dates (dayKey strings), and the historical failure mode was
// local-time Date getters shifting days/months/years back by one for viewers
// behind UTC. Vitest isolates test files in their own worker process, so the
// override cannot leak into other files.
process.env.TZ = "America/Anchorage";

import { describe, expect, it } from "vitest";
import {
  buildProportionalTimeline,
  buildRailMonths,
  buildTimelineGroups,
  buildZoomedTimeline,
  dateAtPosition,
  formatDayLabel,
  formatZoomGroupLabel,
  resolveTimelineZoom,
} from "~/lib/timeline";
import type { PhotoDto } from "~/types/api";

let photoCounter = 0;

function photo(overrides: Partial<PhotoDto> = {}): PhotoDto {
  photoCounter += 1;
  return {
    id: `photo-${photoCounter}`,
    uploaderId: "user-1",
    originalFilename: `photo-${photoCounter}.jpg`,
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

describe("buildTimelineGroups", () => {
  it("groups photos by day, newest day and newest photo first", () => {
    const older = photo({ takenAt: "2026-03-30T08:00:00Z" });
    const newerSameDay = photo({ takenAt: "2026-03-30T20:00:00Z" });
    const newestDay = photo({ takenAt: "2026-04-02T12:00:00Z" });

    const groups = buildTimelineGroups([older, newestDay, newerSameDay]);

    expect(groups.map((group) => group.dayKey)).toEqual([
      "2026-04-02",
      "2026-03-30",
    ]);
    expect(groups[1]!.photos.map((entry) => entry.id)).toEqual([
      newerSameDay.id,
      older.id,
    ]);
  });

  it("falls back to createdAt when takenAt is missing", () => {
    const groups = buildTimelineGroups([
      photo({ takenAt: null, createdAt: "2026-01-05T00:30:00Z" }),
    ]);
    expect(groups[0]!.dayKey).toBe("2026-01-05");
  });
});

describe("buildZoomedTimeline", () => {
  const photos = [
    photo({ takenAt: "2026-04-02T12:00:00Z" }),
    photo({ takenAt: "2026-04-20T12:00:00Z" }),
    photo({ takenAt: "2025-12-31T23:00:00Z" }),
  ];

  it("keeps day granularity for the day zoom", () => {
    const groups = buildZoomedTimeline(photos, "day");
    expect(groups.map((group) => group.key)).toEqual([
      "2026-04-20",
      "2026-04-02",
      "2025-12-31",
    ]);
  });

  it("buckets by first-of-month for the month zoom", () => {
    const groups = buildZoomedTimeline(photos, "month");
    expect(groups.map((group) => group.key)).toEqual([
      "2026-04-01",
      "2025-12-01",
    ]);
    expect(groups[0]!.photos).toHaveLength(2);
  });

  it("buckets by first-of-january for the year zoom", () => {
    const groups = buildZoomedTimeline(photos, "year");
    expect(groups.map((group) => group.key)).toEqual([
      "2026-01-01",
      "2025-01-01",
    ]);
  });
});

describe("buildRailMonths", () => {
  it("collapses groups into months with totals and source indices", () => {
    const groups = buildZoomedTimeline(
      [
        photo({ takenAt: "2026-04-02T12:00:00Z" }),
        photo({ takenAt: "2026-04-02T13:00:00Z" }),
        photo({ takenAt: "2026-04-20T12:00:00Z" }),
        photo({ takenAt: "2025-12-31T23:00:00Z" }),
      ],
      "day",
    );

    const months = buildRailMonths(groups);

    expect(months).toHaveLength(2);
    expect(months[0]).toMatchObject({ year: 2026, month: 4, total: 3 });
    expect(months[0]!.days.map((day) => day.key)).toEqual([
      "2026-04-20",
      "2026-04-02",
    ]);
    expect(months[0]!.days.map((day) => day.groupIdx)).toEqual([0, 1]);
    expect(months[1]).toMatchObject({ year: 2025, month: 12, total: 1 });
  });
});

describe("resolveTimelineZoom", () => {
  it("accepts known zooms and defaults everything else to day", () => {
    expect(resolveTimelineZoom("month")).toBe("month");
    expect(resolveTimelineZoom("year")).toBe("year");
    expect(resolveTimelineZoom("day")).toBe("day");
    expect(resolveTimelineZoom("bogus")).toBe("day");
    expect(resolveTimelineZoom(null)).toBe("day");
  });
});

describe("formatZoomGroupLabel", () => {
  it("labels the exact calendar date regardless of the viewer timezone", () => {
    expect(formatZoomGroupLabel("2026-01-01", "year", "en")).toBe("2026");
    expect(formatZoomGroupLabel("2026-04-01", "month", "en")).toBe(
      "April 2026",
    );
    expect(formatZoomGroupLabel("2026-04-02", "day", "en")).toBe(
      "April 2, 2026",
    );
  });
});

describe("formatDayLabel", () => {
  it("labels the dayKey's own calendar date, not the local-time shift", () => {
    // In America/Anchorage the buggy implementation rendered Jan 1 as Dec 31.
    const label = formatDayLabel("2026-01-01", "en");
    expect(label).toContain("January 1, 2026");
    expect(label).toContain("Thu");
  });
});

describe("buildProportionalTimeline", () => {
  it("returns an empty marker list for no groups", () => {
    expect(buildProportionalTimeline([], "en")).toEqual([]);
  });

  it("emits year and month markers keyed to the dayKey calendar", () => {
    const groups = buildTimelineGroups([
      photo({ takenAt: "2026-01-01T05:00:00Z" }),
      photo({ takenAt: "2025-06-15T05:00:00Z" }),
    ]);

    const markers = buildProportionalTimeline(groups, "en");

    const years = markers.filter((marker) => marker.type === "year");
    const months = markers.filter((marker) => marker.type === "month");
    // Pre-fix, local getters in UTC-9 turned 2026-01-01 into year 2025/Dec.
    expect(years.map((marker) => marker.key)).toEqual(["2026", "2025"]);
    expect(months.map((marker) => marker.label)).toEqual(["Jan", "Jun"]);
    expect(months.map((marker) => marker.key)).toEqual(["2026-0", "2025-5"]);
  });

  it("adds day markers only for significant days in busy months", () => {
    const busyMonth = [
      ...Array.from({ length: 6 }, (_, index) =>
        photo({ takenAt: `2026-03-0${index + 1}T10:00:00Z` }),
      ),
      photo({ takenAt: "2026-03-09T10:00:00Z" }),
      photo({ takenAt: "2026-03-09T11:00:00Z" }),
    ];
    const markers = buildProportionalTimeline(
      buildTimelineGroups(busyMonth),
      "en",
    );

    const dayMarkers = markers.filter((marker) => marker.type === "day");
    // 8 photos in the month; only 2026-03-09 (2 photos = 25%) crosses the
    // 15% significance threshold — the single-photo days (12.5%) do not.
    expect(dayMarkers.map((marker) => marker.key)).toEqual(["2026-03-09"]);
    expect(dayMarkers[0]!.photoCount).toBe(2);
  });

  it("keeps every marker position inside the padded 0..1 rail", () => {
    const markers = buildProportionalTimeline(
      buildTimelineGroups([
        photo({ takenAt: "2026-01-01T05:00:00Z" }),
        photo({ takenAt: "2025-06-15T05:00:00Z" }),
        photo({ takenAt: "2024-06-15T05:00:00Z" }),
      ]),
      "en",
    );
    for (const marker of markers) {
      expect(marker.position).toBeGreaterThanOrEqual(0.04);
      expect(marker.position).toBeLessThanOrEqual(0.96);
    }
  });
});

describe("dateAtPosition", () => {
  const groups = buildTimelineGroups([
    photo({ takenAt: "2026-04-02T12:00:00Z" }),
    photo({ takenAt: "2026-01-01T12:00:00Z" }),
  ]);

  it("returns null for an empty timeline", () => {
    expect(dateAtPosition(0.5, [], "en")).toBeNull();
  });

  it("maps the top of the rail to the newest group with a UTC-stable label", () => {
    const info = dateAtPosition(0, groups, "en");
    expect(info?.dayKey).toBe("2026-04-02");
    expect(info?.label).toBe("Apr 2, 2026");
  });

  it("maps the bottom of the rail to the oldest group", () => {
    const info = dateAtPosition(1, groups, "en");
    expect(info?.dayKey).toBe("2026-01-01");
    expect(info?.label).toBe("Jan 1, 2026");
  });
});
