import { useCallback, useMemo, useRef, useState } from "react";
import type { Locale } from "~/lib/i18n";
import {
  buildDaySectionId,
  dateAtPosition,
  type TimelineGroup,
  type TimelineMarker,
} from "~/lib/timeline";

export function ProportionalTimelineRail(props: {
  timelineGroups: TimelineGroup[];
  markers: TimelineMarker[];
  locale: Locale;
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
      const element = railRef.current;
      if (!element) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      const position = Math.max(
        0,
        Math.min(1, (clientY - rect.top) / rect.height),
      );
      const info = dateAtPosition(position, props.timelineGroups, props.locale);
      return info ? { ...info, topPx: clientY - rect.top, position } : null;
    },
    [props.locale, props.timelineGroups],
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
    (event: React.MouseEvent) => {
      const info = positionToInfo(event.clientY);
      setHoverState(info ? { label: info.label, topPx: info.topPx } : null);
      if (isDraggingRef.current) {
        scrollToPosition(event.clientY);
      }
    },
    [positionToInfo, scrollToPosition],
  );

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      isDraggingRef.current = true;
      setIsDragging(true);
      scrollToPosition(event.clientY);

      const handleGlobalMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current) {
          return;
        }
        const info = positionToInfo(moveEvent.clientY);
        if (info) {
          setHoverState({ label: info.label, topPx: info.topPx });
          scrollToPosition(moveEvent.clientY);
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
    setIsHovering(false);
    if (!isDraggingRef.current) {
      setHoverState(null);
    }
  }, []);

  const visibleLabels = useMemo(() => {
    const yearAndMonthMarkers = props.markers.filter(
      (marker) => marker.type === "year" || marker.type === "month",
    );

    const merged: TimelineMarker[] = [];
    const consumedMonths = new Set<string>();

    for (const marker of yearAndMonthMarkers) {
      if (marker.type === "year") {
        const yearMonths = yearAndMonthMarkers
          .filter(
            (candidate) =>
              candidate.type === "month" &&
              candidate.key.startsWith(`${marker.key}-`),
          )
          .sort((left, right) => left.position - right.position);
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

    const minGap = 0.025;
    const result: TimelineMarker[] = [];
    let lastPosition = -1;

    for (const marker of merged) {
      if (result.length === 0 || marker.position - lastPosition >= minGap) {
        result.push(marker);
        lastPosition = marker.position;
      } else if (marker.type === "year") {
        const previous = result[result.length - 1];
        if (previous && previous.type === "month") {
          result[result.length - 1] = marker;
          lastPosition = marker.position;
        }
      }
    }

    return result;
  }, [props.markers]);

  const showMagnifier = (isHovering || isDragging) && hoverState;

  return (
    <div className="flex h-full gap-3">
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
            onClick={(event) => {
              event.stopPropagation();
              document
                .getElementById(buildDaySectionId(marker.scrollToDayKey))
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            style={{ top: `${(marker.position * 100).toFixed(2)}%` }}
            type="button"
          />
        ))}

        <div
          className={`timeline-magnifier ${showMagnifier ? "timeline-magnifier-visible" : ""}`}
          style={{ top: hoverState?.topPx ?? 0 }}
        >
          {hoverState?.label}
        </div>
      </div>

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
