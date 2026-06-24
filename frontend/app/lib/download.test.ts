import { afterEach, describe, expect, it, vi } from "vitest";
import { triggerBlobDownload } from "./download";

describe("triggerBlobDownload", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("clicks a hidden anchor and defers object-URL revocation", () => {
    vi.useFakeTimers();
    const createObjectUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:download-test");
    const revokeObjectUrl = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const blob = new Blob(["data"], { type: "image/jpeg" });
    triggerBlobDownload(blob, "vacation.jpg");

    expect(createObjectUrl).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledTimes(1);
    // The anchor is cleaned up from the DOM right after the click.
    expect(document.querySelector("a[download]")).toBeNull();
    // Revocation is deferred past the click task, never synchronous — revoking
    // in the same task can truncate the download for large blobs.
    expect(revokeObjectUrl).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:download-test");
  });
});
