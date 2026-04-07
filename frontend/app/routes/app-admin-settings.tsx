import type { Route } from "./+types/app-admin-settings";
import { useEffect, useState } from "react";
import {
  Form,
  Link,
  useActionData,
  useNavigation,
  useRevalidator,
} from "react-router";
import { EmptyHint, InlineMessage, PageHeader, Panel } from "~/components/ui";
import {
  getAdminSettings,
  isBackendUnavailableError,
  updateAdminSettings,
} from "~/lib/api";
import { toErrorMessage } from "~/lib/errors";
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
  | { ok: true; successMessage: string }
  | { ok: false; errorMessage: string };

function parseRequiredInteger(
  value: FormDataEntryValue | null,
  fieldName: string,
) {
  const parsed = Number(String(value ?? "").trim());

  if (!Number.isInteger(parsed)) {
    return `${fieldName} must be an integer.`;
  }

  return parsed;
}

export async function clientLoader({
  request: _request,
}: Route.ClientLoaderArgs): Promise<AdminSettingsLoaderData> {
  try {
    return {
      settings: await getAdminSettings(),
      error: null,
    };
  } catch (error) {
    if (isBackendUnavailableError(error)) {
      throw error;
    }

    return {
      settings: null,
      error: toErrorMessage(error, "Failed to load admin settings."),
    };
  }
}

export async function clientAction({
  request,
}: Route.ClientActionArgs): Promise<UpdateAdminSettingsActionResult> {
  const formData = await request.formData();
  const compressionQuality = parseRequiredInteger(
    formData.get("compressionQuality"),
    "Compression quality",
  );
  if (typeof compressionQuality === "string") {
    return {
      ok: false,
      errorMessage: compressionQuality,
    };
  }

  const compressionMaxResolution = parseRequiredInteger(
    formData.get("compressionMaxResolution"),
    "Compression max resolution",
  );
  if (typeof compressionMaxResolution === "string") {
    return {
      ok: false,
      errorMessage: compressionMaxResolution,
    };
  }

  try {
    await updateAdminSettings({
      registrationMode: String(
        formData.get("registrationMode") ?? "INVITE_ONLY",
      ) as RegistrationMode,
      compressionFormat: String(
        formData.get("compressionFormat") ?? "jpg",
      ) as CompressionFormat,
      compressionQuality,
      compressionMaxResolution,
    });

    return {
      ok: true,
      successMessage: "Settings updated.",
    };
  } catch (error) {
    return {
      ok: false,
      errorMessage: toActionErrorMessage(error, "Failed to update settings."),
    };
  }
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "Admin Settings | PINA" }];
}

export default function AppAdminSettingsRoute({
  loaderData,
}: Route.ComponentProps) {
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const [draft, setDraft] = useState<AdminSettingsDto | null>(
    loaderData.settings,
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isSaving = navigation.state !== "idle";
  const errorMessage =
    actionData && !actionData.ok ? actionData.errorMessage : null;

  useEffect(() => {
    setDraft(loaderData.settings);
  }, [loaderData.settings]);

  useEffect(() => {
    if (!actionData) {
      return;
    }

    if (actionData.ok) {
      setSuccessMessage(actionData.successMessage);
      revalidator.revalidate();
      return;
    }

    setSuccessMessage(null);
  }, [actionData, revalidator]);

  const hasDraftChanges =
    loaderData.settings != null &&
    draft != null &&
    (draft.registrationMode !== loaderData.settings.registrationMode ||
      draft.compressionFormat !== loaderData.settings.compressionFormat ||
      draft.compressionQuality !== loaderData.settings.compressionQuality ||
      draft.compressionMaxResolution !==
        loaderData.settings.compressionMaxResolution);

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Link className="button-secondary" to="/app/admin/health">
              Open health
            </Link>
            <Link className="button-secondary" to="/app/admin/storage">
              Open storage
            </Link>
          </>
        }
        description="View and update the supported mutable instance settings exposed by the backend admin API."
        eyebrow="Admin Settings"
        title="Instance settings"
      />

      {loaderData.error ? (
        <InlineMessage tone="danger">{loaderData.error}</InlineMessage>
      ) : null}
      {errorMessage ? (
        <InlineMessage tone="danger">{errorMessage}</InlineMessage>
      ) : null}
      {successMessage ? (
        <InlineMessage tone="success">{successMessage}</InlineMessage>
      ) : null}

      {!draft ? (
        <Panel className="p-6">
          <p className="eyebrow">Settings</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Settings are unavailable
          </h2>
          <EmptyHint className="mt-5 px-5 py-6 leading-7">
            The admin shell remains active, but this request could not load the
            mutable instance settings snapshot.
          </EmptyHint>
        </Panel>
      ) : (
        <Panel className="p-6">
          <p className="eyebrow">Mutable configuration</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Registration and compression
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
            Registration mode changes apply immediately to sign-up flows.
            Compression settings affect new uploads only.
          </p>

          <Form className="mt-6 space-y-5" method="post">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">
                Registration mode
              </span>
              <select
                aria-label="Registration mode"
                className="field"
                name="registrationMode"
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          registrationMode: event.target
                            .value as RegistrationMode,
                        }
                      : current,
                  )
                }
                value={draft.registrationMode}
              >
                <option value="OPEN">Open</option>
                <option value="INVITE_ONLY">Invite only</option>
                <option value="CLOSED">Closed</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium">
                Compression format
              </span>
              <select
                aria-label="Compression format"
                className="field"
                name="compressionFormat"
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          compressionFormat: event.target
                            .value as CompressionFormat,
                        }
                      : current,
                  )
                }
                value={draft.compressionFormat}
              >
                <option value="jpg">jpg</option>
                <option value="jpeg">jpeg</option>
                <option value="png">png</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium">
                Compression quality
              </span>
              <input
                aria-label="Compression quality"
                className="field"
                max={100}
                min={1}
                name="compressionQuality"
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          compressionQuality: Number(event.target.value),
                        }
                      : current,
                  )
                }
                type="number"
                value={draft.compressionQuality}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium">
                Compression max resolution
              </span>
              <input
                aria-label="Compression max resolution"
                className="field"
                min={100}
                name="compressionMaxResolution"
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          compressionMaxResolution: Number(event.target.value),
                        }
                      : current,
                  )
                }
                type="number"
                value={draft.compressionMaxResolution}
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                className="button-primary"
                disabled={isSaving || !hasDraftChanges}
                type="submit"
              >
                {isSaving ? "Saving settings..." : "Save changes"}
              </button>
              <button
                className="button-secondary"
                disabled={
                  isSaving || loaderData.settings == null || !hasDraftChanges
                }
                onClick={() => {
                  setDraft(loaderData.settings);
                  setSuccessMessage(null);
                }}
                type="button"
              >
                Reset
              </button>
            </div>
          </Form>
        </Panel>
      )}
    </div>
  );
}
