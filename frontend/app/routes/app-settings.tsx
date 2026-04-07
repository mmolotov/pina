import type { Route } from "./+types/app-settings";
import { useEffect, useRef, useState } from "react";
import { Form, Link, useActionData, useNavigation } from "react-router";
import { Badge, InlineMessage, PageHeader, Panel } from "~/components/ui";
import { getCurrentUser, updateCurrentUser } from "~/lib/api";
import { toActionErrorMessage } from "~/lib/route-actions";
import { updateSessionUser, useSession } from "~/lib/session";

interface ProfileDraft {
  name: string;
  email: string;
}

export async function clientLoader() {
  return getCurrentUser();
}

type UpdateProfileActionResult =
  | { ok: true; user: Awaited<ReturnType<typeof getCurrentUser>> }
  | { ok: false; errorMessage: string };

export async function clientAction({
  request,
}: Route.ClientActionArgs): Promise<UpdateProfileActionResult> {
  const formData = await request.formData();

  try {
    const user = await updateCurrentUser({
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim() || null,
    });
    return { ok: true, user };
  } catch (error) {
    return {
      ok: false,
      errorMessage: toActionErrorMessage(error, "Failed to update profile."),
    };
  }
}

export default function AppSettingsRoute({ loaderData }: Route.ComponentProps) {
  const session = useSession();
  const hasSession = session !== null;
  const sessionName = session?.user.name ?? "";
  const sessionEmail = session?.user.email ?? "";
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const [draft, setDraft] = useState<ProfileDraft>({
    name: loaderData.name ?? sessionName,
    email: loaderData.email ?? sessionEmail,
  });
  const hasLocalEditsRef = useRef(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isSaving = navigation.state !== "idle";
  const hasUnsavedChanges =
    draft.name !== (loaderData.name ?? "") ||
    draft.email !== (loaderData.email ?? "");

  useEffect(() => {
    if (!hasSession || hasLocalEditsRef.current) {
      return;
    }

    setDraft({
      name: sessionName,
      email: sessionEmail,
    });
  }, [hasSession, sessionEmail, sessionName]);

  useEffect(() => {
    if (!loaderData || hasLocalEditsRef.current) {
      return;
    }

    setDraft({
      name: loaderData.name ?? "",
      email: loaderData.email ?? "",
    });
    updateSessionUser(loaderData);
  }, [loaderData]);

  useEffect(() => {
    if (!actionData) {
      return;
    }

    if (actionData.ok) {
      hasLocalEditsRef.current = false;
      updateSessionUser(actionData.user);
      setDraft({
        name: actionData.user.name ?? "",
        email: actionData.user.email ?? "",
      });
      setSuccessMessage("Profile updated.");
      return;
    }

    setSuccessMessage(null);
  }, [actionData]);

  const errorMessage =
    actionData && !actionData.ok ? actionData.errorMessage : null;

  return (
    <div className="space-y-8">
      <PageHeader
        description="Manage the profile data exposed by the current authenticated session."
        eyebrow="Settings"
        title="Profile"
      />

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel className="p-6">
          <p className="eyebrow">Current identity</p>
          <div className="mt-5 flex items-start gap-4">
            <div className="avatar-token">
              {(session?.user.name ?? "U").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold tracking-tight">
                {session?.user.name ?? "Unknown user"}
              </h2>
              <p className="mt-2 break-all text-sm text-[var(--color-text-muted)]">
                {session?.user.email ?? "No email configured"}
              </p>
              <p className="mt-4 text-sm leading-7 text-[var(--color-text-muted)]">
                Avatar upload and account linking will arrive in a later
                frontend step. This screen already keeps the in-memory session
                and profile endpoint in sync.
              </p>
            </div>
          </div>
        </Panel>

        <Panel className="p-6">
          <p className="eyebrow">Edit profile</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Update visible account data
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Badge className="rounded-full px-3 py-1 text-xs font-semibold">
              {hasUnsavedChanges ? "Unsaved changes" : "In sync"}
            </Badge>
            <Link className="button-secondary" to="/app/favorites">
              Open favorites
            </Link>
          </div>

          <Form className="mt-6 space-y-5" method="post">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">
                Display name
              </span>
              <input
                aria-label="Display name"
                className="field"
                maxLength={255}
                name="name"
                onChange={(event) => {
                  hasLocalEditsRef.current = true;
                  setSuccessMessage(null);
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }));
                }}
                required
                value={draft.name}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium">Email</span>
              <input
                aria-label="Email"
                className="field"
                maxLength={255}
                name="email"
                onChange={(event) => {
                  hasLocalEditsRef.current = true;
                  setSuccessMessage(null);
                  setDraft((current) => ({
                    ...current,
                    email: event.target.value,
                  }));
                }}
                placeholder="name@example.com"
                type="email"
                value={draft.email}
              />
            </label>

            {errorMessage ? (
              <InlineMessage tone="danger">{errorMessage}</InlineMessage>
            ) : null}

            {successMessage ? (
              <InlineMessage tone="success">{successMessage}</InlineMessage>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                className="button-primary"
                disabled={isSaving || !hasUnsavedChanges}
                type="submit"
              >
                {isSaving ? "Saving..." : "Save profile"}
              </button>
              <button
                className="button-secondary"
                disabled={!hasUnsavedChanges || isSaving}
                onClick={() => {
                  hasLocalEditsRef.current = false;
                  setSuccessMessage(null);
                  setDraft({
                    name: loaderData.name ?? "",
                    email: loaderData.email ?? "",
                  });
                }}
                type="button"
              >
                Reset changes
              </button>
            </div>
          </Form>
        </Panel>
      </section>
    </div>
  );
}
