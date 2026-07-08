import { afterEach, describe, expect, it } from "vitest";
import {
  avatarIndex,
  fmtDate,
  fmtNum,
  initials,
  pluralWord,
} from "~/lib/admin-format";

// getActiveLocale resolves from <html lang>, so tests pin it explicitly.
function withLang(lang: string) {
  document.documentElement.lang = lang;
}

afterEach(() => {
  document.documentElement.removeAttribute("lang");
});

describe("fmtNum", () => {
  it("formats numbers with the active locale's grouping", () => {
    withLang("en");
    expect(fmtNum(1234567)).toBe("1,234,567");
  });

  it("treats null and undefined as zero", () => {
    withLang("en");
    expect(fmtNum(null)).toBe("0");
    expect(fmtNum(undefined)).toBe("0");
  });
});

describe("fmtDate", () => {
  it("formats an ISO timestamp", () => {
    withLang("en");
    expect(fmtDate("2026-07-03T10:00:00Z")).toMatch(/Jul \d{1,2}, 2026/);
  });

  it("returns an em dash for missing or invalid input", () => {
    expect(fmtDate(null)).toBe("—");
    expect(fmtDate(undefined)).toBe("—");
    expect(fmtDate("not-a-date")).toBe("—");
  });
});

describe("pluralWord", () => {
  const forms = { one: "фото", few: "фото", many: "фотографий", other: "фото" };

  it("selects Russian plural categories", () => {
    withLang("ru");
    expect(pluralWord(1, forms)).toBe("фото");
    expect(pluralWord(5, forms)).toBe("фотографий");
  });

  it("falls back to other when a category form is missing", () => {
    withLang("ru");
    expect(pluralWord(5, { one: "день", other: "дней" })).toBe("дней");
  });
});

describe("avatarIndex", () => {
  it("is deterministic and stays within the palette", () => {
    const first = avatarIndex("anna@example.com");
    expect(avatarIndex("anna@example.com")).toBe(first);
    for (const seed of ["", "a", "Борис", "x".repeat(300)]) {
      const index = avatarIndex(seed);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(9);
    }
  });
});

describe("initials", () => {
  it("takes the first letters of the first two words, uppercased", () => {
    expect(initials("anna karenina")).toBe("AK");
    expect(initials("Anna Karenina Third")).toBe("AK");
    expect(initials("solo")).toBe("S");
  });
});
