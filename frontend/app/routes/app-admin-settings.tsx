import type { Route } from "./+types/app-admin-settings";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { Settings2 } from "lucide-react";
import { AEmpty } from "~/components/admin/ui";
import {
  getAdminSettings,
  isBackendUnavailableError,
  updateAdminSettings,
} from "~/lib/api";
import { toErrorMessage } from "~/lib/errors";
import {
  getActiveLocale,
  translateMessage,
  useI18n,
  type MessageKey,
} from "~/lib/i18n";
import { toActionErrorMessage } from "~/lib/route-actions";
import type {
  AdminSettingsDto,
  CompressionFormat,
  RegistrationMode,
} from "~/types/api";

interface AdminSettingsLoaderData {
  settings: AdminSettingsDto | null;
  error: string | null;
}

type UpdateAdminSettingsActionResult =
  | { ok: true }
  | { ok: false; errorMessage: string };

export async function clientLoader({
  request: _request,
}: Route.ClientLoaderArgs): Promise<AdminSettingsLoaderData> {
  try {
    return { settings: await getAdminSettings(), error: null };
  } catch (error) {
    if (isBackendUnavailableError(error)) {
      throw error;
    }
    return {
      settings: null,
      error: toErrorMessage(
        error,
        translateMessage(getActiveLocale(), "app.admin.settings.loadFailed"),
      ),
    };
  }
}

export async function clientAction({
  request,
}: Route.ClientActionArgs): Promise<UpdateAdminSettingsActionResult> {
  const formData = await request.formData();
  const quality = Number(formData.get("compressionQuality"));
  const maxResolution = Number(formData.get("compressionMaxResolution"));

  try {
    await updateAdminSettings({
      registrationMode: String(
        formData.get("registrationMode") ?? "INVITE_ONLY",
      ) as RegistrationMode,
      compressionFormat: String(
        formData.get("compressionFormat") ?? "jpeg",
      ) as CompressionFormat,
      compressionQuality: Number.isFinite(quality) ? quality : 80,
      compressionMaxResolution: Number.isFinite(maxResolution)
        ? maxResolution
        : 4096,
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      errorMessage: toActionErrorMessage(
        error,
        translateMessage(getActiveLocale(), "app.admin.settings.saveFailed"),
      ),
    };
  }
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "Admin Settings | PINA" }];
}

const REG_MODES: {
  id: RegistrationMode;
  labelKey: MessageKey;
  descKey: MessageKey;
}[] = [
  {
    id: "OPEN",
    labelKey: "app.admin.settings.regOpen",
    descKey: "app.admin.settings.regOpenDesc",
  },
  {
    id: "INVITE_ONLY",
    labelKey: "app.admin.settings.regInvite",
    descKey: "app.admin.settings.regInviteDesc",
  },
  {
    id: "CLOSED",
    labelKey: "app.admin.settings.regClosed",
    descKey: "app.admin.settings.regClosedDesc",
  },
];

interface FieldErrors {
  quality?: string;
  resolution?: string;
}

export default function AppAdminSettingsRoute({
  loaderData,
}: Route.ComponentProps) {
  const { t } = useI18n();
  const fetcher = useFetcher<UpdateAdminSettingsActionResult>();
  const [draft, setDraft] = useState<AdminSettingsDto | null>(
    loaderData.settings,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [toast, setToast] = useState<{ label: string; ok: boolean } | null>(
    null,
  );
  const adoptLoaderSettings = useRef(false);
  const toastTimer = useRef<number | null>(null);
  const pendingToast = useRef<string | null>(null);
  const saving = fetcher.state !== "idle";

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = (label: string, ok: boolean) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ label, ok });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    if (adoptLoaderSettings.current) {
      adoptLoaderSettings.current = false;
      setDraft(loaderData.settings);
    }
  }, [loaderData.settings]);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) {
      return;
    }
    if (fetcher.data.ok) {
      showToast(pendingToast.current ?? "", true);
      adoptLoaderSettings.current = true;
    } else {
      showToast(fetcher.data.errorMessage, false);
    }
    pendingToast.current = null;
  }, [fetcher.state, fetcher.data]);

  if (!draft || !loaderData.settings) {
    return (
      <>
        <div className="adm-section-head">
          <div>
            <h2 className="adm-section-title">
              {t("app.admin.settings.title")}
            </h2>
          </div>
        </div>
        <AEmpty
          icon={<Settings2 size={22} />}
          text={loaderData.error ?? t("app.admin.loadErrorText")}
          title={t("app.admin.loadErrorTitle")}
        />
      </>
    );
  }

  const saved = loaderData.settings;
  const dirty =
    draft.registrationMode !== saved.registrationMode ||
    draft.compressionFormat !== saved.compressionFormat ||
    draft.compressionQuality !== saved.compressionQuality ||
    draft.compressionMaxResolution !== saved.compressionMaxResolution;
  const isPng = draft.compressionFormat === "png";

  function update<K extends keyof AdminSettingsDto>(
    key: K,
    value: AdminSettingsDto[K],
  ) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function save() {
    if (!draft) {
      return;
    }
    const nextErrors: FieldErrors = {};
    if (draft.compressionQuality < 1 || draft.compressionQuality > 100) {
      nextErrors.quality = t("app.admin.settings.qualityError");
    }
    if (draft.compressionMaxResolution < 256) {
      nextErrors.resolution = t("app.admin.settings.resolutionMin");
    } else if (draft.compressionMaxResolution > 16384) {
      nextErrors.resolution = t("app.admin.settings.resolutionMax");
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    pendingToast.current = t("app.admin.settings.toastSaved");
    fetcher.submit(
      {
        registrationMode: draft.registrationMode,
        compressionFormat: draft.compressionFormat,
        compressionQuality: String(draft.compressionQuality),
        compressionMaxResolution: String(draft.compressionMaxResolution),
      },
      { method: "post" },
    );
  }

  return (
    <>
      <div className="adm-section-head">
        <div>
          <h2 className="adm-section-title">{t("app.admin.settings.title")}</h2>
          <p className="adm-section-sub">{t("app.admin.settings.sub")}</p>
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-form">
          <div className="adm-field-group">
            <div className="adm-field-label">
              {t("app.admin.settings.regTitle")}
            </div>
            <div className="adm-field-hint">
              {t("app.admin.settings.regHint")}
            </div>
            <div className="adm-radio-cards" style={{ marginTop: ".25rem" }}>
              {REG_MODES.map((mode) => (
                <button
                  aria-pressed={draft.registrationMode === mode.id}
                  className={`adm-radio-card${draft.registrationMode === mode.id ? " active" : ""}`}
                  key={mode.id}
                  onClick={() => update("registrationMode", mode.id)}
                  type="button"
                >
                  <b>{t(mode.labelKey)}</b>
                  <span>{t(mode.descKey)}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: "var(--color-border)" }} />

          <div className="adm-field-group">
            <div className="adm-field-label">
              {t("app.admin.settings.formatTitle")}
            </div>
            <div className="adm-field-hint">
              {t("app.admin.settings.formatHint")}
            </div>
            <div
              className="adm-seg"
              style={{ marginTop: ".25rem", alignSelf: "flex-start" }}
            >
              <button
                className={!isPng ? "on" : ""}
                onClick={() => update("compressionFormat", "jpeg")}
                type="button"
              >
                JPEG
              </button>
              <button
                className={isPng ? "on" : ""}
                onClick={() => update("compressionFormat", "png")}
                type="button"
              >
                PNG
              </button>
            </div>
          </div>

          <div className="adm-field-group">
            <div
              className="adm-field-label"
              style={{ display: "flex", justifyContent: "space-between" }}
            >
              <span>{t("app.admin.settings.qualityTitle")}</span>
              <span
                style={{
                  color: "var(--color-accent-strong)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {draft.compressionQuality}
              </span>
            </div>
            <input
              aria-label={t("app.admin.settings.qualityTitle")}
              className="adm-slider"
              disabled={isPng}
              max="100"
              min="1"
              onChange={(event) =>
                update("compressionQuality", Number(event.target.value))
              }
              step="1"
              type="range"
              value={draft.compressionQuality}
            />
            <div className="adm-field-hint">
              {isPng
                ? t("app.admin.settings.qualityHintPng")
                : t("app.admin.settings.qualityHintJpeg")}
            </div>
            {errors.quality ? (
              <div
                className="adm-field-hint"
                style={{ color: "var(--color-danger-strong)" }}
              >
                {errors.quality}
              </div>
            ) : null}
          </div>

          <div className="adm-field-group" style={{ maxWidth: "20rem" }}>
            <div className="adm-field-label">
              {t("app.admin.settings.resolutionTitle")}
            </div>
            <div className="adm-field-hint">
              {t("app.admin.settings.resolutionHint")}
            </div>
            <input
              aria-label={t("app.admin.settings.resolutionTitle")}
              className="field"
              max="16384"
              min="256"
              onChange={(event) =>
                update("compressionMaxResolution", Number(event.target.value))
              }
              step="64"
              type="number"
              value={draft.compressionMaxResolution}
            />
            {errors.resolution ? (
              <div
                className="adm-field-hint"
                style={{ color: "var(--color-danger-strong)" }}
              >
                {errors.resolution}
              </div>
            ) : null}
          </div>

          <div className="adm-form-foot">
            <span className="adm-dirty-note">
              {dirty
                ? t("app.admin.settings.dirty")
                : t("app.admin.settings.clean")}
            </span>
            <span className="spacer" />
            <button
              className="button-secondary"
              disabled={!dirty || saving}
              onClick={() => {
                setDraft(saved);
                setErrors({});
              }}
              type="button"
            >
              {t("app.admin.settings.reset")}
            </button>
            <button
              className="button-primary"
              disabled={!dirty || saving}
              onClick={save}
              style={{ minWidth: "9rem" }}
              type="button"
            >
              {saving
                ? t("app.admin.settings.saving")
                : t("app.admin.settings.save")}
            </button>
          </div>
        </div>
      </div>

      {toast ? (
        <div className={`adm-toast${toast.ok ? " ok" : ""}`} role="status">
          {toast.label}
        </div>
      ) : null}
    </>
  );
}
