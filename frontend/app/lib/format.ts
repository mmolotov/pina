import { getActiveLocale, translateMessage } from "~/lib/i18n";

interface RelativeCountForms {
  one: string;
  other: string;
  few?: string;
  many?: string;
}

export function formatDateTime(value: string | null) {
  const locale = getActiveLocale();

  if (!value) {
    return translateMessage(locale, "common.notAvailable");
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDateRange(
  start: string | null,
  end: string | null,
  locale = getActiveLocale(),
) {
  if (!start && !end) {
    return translateMessage(locale, "common.notAvailable");
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
  });
  const startLabel = start ? formatter.format(new Date(start)) : null;
  const endLabel = end ? formatter.format(new Date(end)) : null;

  if (startLabel && endLabel) {
    return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
  }

  return startLabel ?? endLabel ?? translateMessage(locale, "common.notAvailable");
}

export function formatRelativeCount(
  count: number,
  singularOrForms: string | RelativeCountForms,
  plural?: string,
) {
  const locale = getActiveLocale();
  const formattedCount = new Intl.NumberFormat(locale).format(count);

  if (typeof singularOrForms === "string") {
    const category = new Intl.PluralRules(locale).select(count);
    const unit =
      category === "one" ? singularOrForms : (plural ?? singularOrForms);
    return `${formattedCount} ${unit}`;
  }

  const category = new Intl.PluralRules(locale).select(count);
  const unit =
    (category === "few" ? singularOrForms.few : undefined) ??
    (category === "many" ? singularOrForms.many : undefined) ??
    (category === "one" ? singularOrForms.one : undefined) ??
    singularOrForms.other;

  return `${formattedCount} ${unit}`;
}

export function formatBytes(bytes: number) {
  const locale = getActiveLocale();

  if (bytes < 1024) {
    return `${new Intl.NumberFormat(locale).format(bytes)} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const formattedValue = new Intl.NumberFormat(locale, {
    maximumFractionDigits: value >= 100 ? 0 : 1,
    minimumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value);

  return `${formattedValue} ${units[unitIndex]}`;
}
