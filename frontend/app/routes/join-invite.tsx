import type { Route } from "./+types/join-invite";
import { useEffect } from "react";
import {
  Form,
  Link,
  useActionData,
  useNavigate,
  useNavigation,
} from "react-router";
import { joinInvite, previewInvite } from "~/lib/api";
import { toActionErrorMessage } from "~/lib/route-actions";
import { getSessionSnapshot, useSession } from "~/lib/session";

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const code = params.code ?? "";
  return previewInvite(code);
}

type JoinInviteActionResult =
  | { ok: true }
  | { ok: false; errorMessage?: string; redirectTo?: string };

export async function clientAction({
  params,
}: Route.ClientActionArgs): Promise<JoinInviteActionResult> {
  const code = params.code ?? "";
  const session = getSessionSnapshot();

  if (!session) {
    return {
      ok: false,
      redirectTo: `/login?redirect=${encodeURIComponent(`/join/${code}`)}`,
    };
  }

  try {
    await joinInvite(code);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      errorMessage: toActionErrorMessage(error, "Failed to join invite."),
    };
  }
}

export default function JoinInviteRoute({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const session = useSession();
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const isJoining = navigation.state !== "idle";
  const errorMessage =
    actionData && !actionData.ok ? (actionData.errorMessage ?? null) : null;

  useEffect(() => {
    if (!actionData) {
      return;
    }

    if (actionData.ok) {
      navigate("/app/spaces", { replace: true });
      return;
    }

    if (actionData.redirectTo) {
      navigate(actionData.redirectTo, { replace: true });
    }
  }, [actionData, navigate]);

  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-6 py-10">
      <section className="panel w-full max-w-2xl p-8 sm:p-10">
        <p className="eyebrow">Invite Link</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Join Space
        </h1>

        {errorMessage ? (
          <p className="mt-5 rounded-2xl border border-[rgba(161,69,63,0.25)] bg-[rgba(161,69,63,0.08)] px-4 py-3 text-sm text-[var(--color-danger)]">
            {errorMessage}
          </p>
        ) : null}

        {loaderData ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-panel-strong)] p-5">
              <p className="eyebrow">Space</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                {loaderData.spaceName}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
                {loaderData.spaceDescription || "No description"}
              </p>
              <p className="mt-4 text-sm text-[var(--color-text-muted)]">
                Default role:{" "}
                <span className="font-semibold text-[var(--color-text)]">
                  {loaderData.defaultRole}
                </span>
              </p>
              <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
                {session
                  ? "Your current account can accept this invite immediately."
                  : "Log in first and then return here to join the Space."}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
                <p className="eyebrow">Join role</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">
                  {loaderData.defaultRole}
                </p>
              </div>
              <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
                <p className="eyebrow">Session state</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">
                  {session ? "Authenticated" : "Login required"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Form method="post">
                <button
                  className="button-primary"
                  disabled={isJoining}
                  type="submit"
                >
                  {isJoining
                    ? "Joining..."
                    : session
                      ? "Join Space"
                      : "Log in to join"}
                </button>
              </Form>
              <Link className="button-secondary" to="/">
                Back home
              </Link>
            </div>
          </div>
        ) : !errorMessage ? (
          <p className="mt-5 text-sm text-[var(--color-text-muted)]">
            Loading invite preview...
          </p>
        ) : null}
      </section>
    </main>
  );
}
