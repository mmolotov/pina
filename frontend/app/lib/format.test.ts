import { beforeEach, describe, expect, it } from "vitest";
import { formatBytes, formatDateTime, formatRelativeCount } from "~/lib/format";

describe("format helpers", () => {
  beforeEach(() => {
    document.documentElement.lang = "en";
  });

  it("formats date-time using the active locale", () => {
    const value = "2026-04-02T10:05:00Z";

    document.documentElement.lang = "ru";

    expect(formatDateTime(value)).toBe(
      new Intl.DateTimeFormat("ru", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value)),
    );
  });

  it("formats relative counts with locale-aware plural selection", () => {
    document.documentElement.lang = "ru";

    expect(
      formatRelativeCount(2, {
        one: "элемент",
        few: "элемента",
        many: "элементов",
        other: "элемента",
      }),
    ).toBe("2 элемента");
  });

  it("formats byte values using the active locale number formatter", () => {
    document.documentElement.lang = "ru";

    expect(formatBytes(1536)).toBe(
      `${new Intl.NumberFormat("ru", {
        maximumFractionDigits: 1,
        minimumFractionDigits: 1,
      }).format(1.5)} KB`,
    );
  });
});
