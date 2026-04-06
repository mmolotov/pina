import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { I18nProvider, LOCALE_STORAGE_KEY, useI18n } from "~/lib/i18n";

function LocaleProbe() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div>
      <p>Current locale: {locale}</p>
      <p>Preference help: {t("language.preferenceHelp")}</p>
      <button
        onClick={() => setLocale(locale === "en" ? "ru" : "en")}
        type="button"
      >
        Toggle locale
      </button>
    </div>
  );
}

describe("I18nProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "en";
    delete document.documentElement.dataset.locale;
  });

  it("uses the persisted locale preference on mount", async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "ru");

    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    );

    expect(screen.getByText("Current locale: ru")).toBeInTheDocument();

    await waitFor(() => {
      expect(document.documentElement.lang).toBe("ru");
      expect(document.documentElement.dataset.locale).toBe("ru");
    });
  });

  it("toggles the locale and persists the next preference", async () => {
    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    );

    expect(screen.getByText("Current locale: en")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Toggle locale" }));

    expect(screen.getByText("Current locale: ru")).toBeInTheDocument();

    await waitFor(() => {
      expect(document.documentElement.lang).toBe("ru");
      expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("ru");
    });
  });

  it("falls back to English when a locale key is missing", () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "ru");

    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    );

    expect(
      screen.getByText(
        "Preference help: Language preference updates immediately.",
      ),
    ).toBeInTheDocument();
  });
});
