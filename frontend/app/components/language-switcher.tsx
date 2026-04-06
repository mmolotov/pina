import { useId } from "react";
import { useI18n, type Locale } from "~/lib/i18n";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  const selectId = useId();

  return (
    <div className={className}>
      <label className="sr-only" htmlFor={selectId}>
        {t("language.label")}
      </label>
      <select
        aria-label={t("language.label")}
        className="field min-w-[9rem]"
        id={selectId}
        onChange={(event) => setLocale(event.target.value as Locale)}
        title={t("language.preferenceHelp")}
        value={locale}
      >
        <option value="en">{t("language.english")}</option>
        <option value="ru">{t("language.russian")}</option>
      </select>
    </div>
  );
}
