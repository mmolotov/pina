import { formatBytes, formatRelativeCount } from "~/lib/format";
import { getActiveLocale } from "~/lib/i18n";

// Locale-aware admin formatters (the prototype hard-codes ru-RU; here everything
// follows the active locale via Intl). fmtBytes reuses the app-wide helper.
export { formatBytes as fmtBytes, formatRelativeCount };

export function fmtNum(value: number | null | undefined): string {
  return new Intl.NumberFormat(getActiveLocale()).format(value ?? 0);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat(getActiveLocale(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

interface PluralForms {
  one: string;
  few?: string;
  many?: string;
  other: string;
}

/** Locale-aware plural word (no number) — the equivalent of the prototype's pluralA. */
export function pluralWord(count: number, forms: PluralForms): string {
  const category = new Intl.PluralRules(getActiveLocale()).select(count);
  return (
    (category === "few" ? forms.few : undefined) ??
    (category === "many" ? forms.many : undefined) ??
    (category === "one" ? forms.one : undefined) ??
    forms.other
  );
}

const AVATAR_COLOR_COUNT = 9;

/**
 * Deterministic avatar palette index for a seed (name/email). The colors live in
 * app.css (`.adm-avatar[data-av="N"]`) so component code stays free of color
 * literals (guard:design).
 */
export function avatarIndex(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash % AVATAR_COLOR_COUNT;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}
