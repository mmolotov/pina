import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProportionalTimelineRail } from "~/components/proportional-timeline-rail";

describe("ProportionalTimelineRail", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("removes document drag listeners when unmounted during an active drag", () => {
    const addListenerSpy = vi.spyOn(document, "addEventListener");
    const removeListenerSpy = vi.spyOn(document, "removeEventListener");
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { container, unmount } = render(
      <div style={{ height: 240 }}>
        <ProportionalTimelineRail
          locale="en"
          markers={[
            {
              key: "2026",
              label: "2026",
              photoCount: 1,
              position: 0.5,
              scrollToDayKey: "2026-04-01",
              type: "year",
            },
          ]}
          timelineGroups={[
            {
              dayKey: "2026-04-01",
              photos: [
                {
                  createdAt: "2026-04-01T10:00:00Z",
                  exifData: null,
                  height: 800,
                  id: "photo-1",
                  latitude: null,
                  longitude: null,
                  mimeType: "image/jpeg",
                  originalFilename: "photo-1.jpg",
                  personalLibraryId: "library-1",
                  sizeBytes: 1234,
                  takenAt: null,
                  uploaderId: "user-1",
                  variants: [],
                  width: 1200,
                },
              ],
            },
          ]}
        />
      </div>,
    );

    const rail = container.querySelector('[role="presentation"]');
    expect(rail).not.toBeNull();

    fireEvent.mouseDown(rail!, { button: 0, clientY: 24 });

    const mouseMoveListener = addListenerSpy.mock.calls.find(
      ([type]) => type === "mousemove",
    )?.[1];
    const mouseUpListener = addListenerSpy.mock.calls.find(
      ([type]) => type === "mouseup",
    )?.[1];

    expect(mouseMoveListener).toBeDefined();
    expect(mouseUpListener).toBeDefined();

    unmount();

    expect(removeListenerSpy).toHaveBeenCalledWith(
      "mousemove",
      mouseMoveListener,
    );
    expect(removeListenerSpy).toHaveBeenCalledWith("mouseup", mouseUpListener);

    fireEvent.mouseMove(document, { clientY: 48 });
    fireEvent.mouseUp(document);

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
