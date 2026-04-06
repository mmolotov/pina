import type { Route } from "./+types/join-invite";
import { useEffect } from "react";
import {
  Form,
  Link,
  useActionData,
  useNavigate,
  useNavigation,
} from "react-router";
import { LanguageSwitcher } from "~/components/language-switcher";
import { InlineMessage, SurfaceCard } from "~/components/ui";
import { joinInvite, previewInvite } from "~/lib/api";
import {
  getActiveLocale,
  type MessageKey,
  translateMessage,
  useI18n,
} from "~/lib/i18n";
import { toActionErrorMessage } from "~/lib/route-actions";
import { getSessionSnapshot, useSession } from "~/lib/session";

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const code = params.code ?? "";
  return previewInvite(code);
}

type JoinInviteActionResult =
  | { ok: true }
  | { ok: false; errorMessage?: string; redirectTo?: string };

function getRoleMessageKey(role: string): MessageKey {
  switch (role) {
    case "OWNER":
      return "role.owner";
    case "ADMIN":
      return "role.admin";
    case "MEMBER":
      return "role.member";
    default:
      return "role.viewer";
  }
}

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
      errorMessage: toActionErrorMessage(
        error,
        translateMessage(getActiveLocale(), "public.joinInvite.errorFallback"),
      ),
    };
  }
}

export default function JoinInviteRoute({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const session = useSession();
  const { t } = useI18n();
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
        <div className="flex items-start justify-between gap-4">
          <p className="eyebrow">{t("public.joinInvite.eyebrow")}</p>
          <LanguageSwitcher />
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          {t("public.joinInvite.title")}
        </h1>

        {errorMessage ? (
          <InlineMessage className="mt-5" tone="danger">
            {errorMessage}
          </InlineMessage>
        ) : null}

        {loaderData ? (
          <div className="mt-6 space-y-4">
            <SurfaceCard className="rounded-3xl p-5">
              <p className="eyebrow">{t("public.joinInvite.spaceEyebrow")}</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                {loaderData.spaceName}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
                {loaderData.spaceDescription ||
                  t("public.joinInvite.noDescription")}
              </p>
              <p className="mt-4 text-sm text-[var(--color-text-muted)]">
                {t("public.joinInvite.defaultRole")}:{" "}
                <span className="font-semibold text-[var(--color-text)]">
                  {t(getRoleMessageKey(loaderData.defaultRole))}
                </span>
              </p>
              <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
                {session
                  ? t("public.joinInvite.sessionCanJoin")
                  : t("public.joinInvite.loginFirst")}
              </p>
            </SurfaceCard>

            <div className="grid gap-4 md:grid-cols-2">
              <SurfaceCard className="rounded-3xl p-5" tone="subtle">
                <p className="eyebrow">
                  {t("public.joinInvite.joinRoleEyebrow")}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">
                  {t(getRoleMessageKey(loaderData.defaultRole))}
                </p>
              </SurfaceCard>
              <SurfaceCard className="rounded-3xl p-5" tone="subtle">
                <p className="eyebrow">
                  {t("public.joinInvite.sessionStateEyebrow")}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">
                  {session
                    ? t("public.joinInvite.authenticated")
                    : t("public.joinInvite.loginRequired")}
                </p>
              </SurfaceCard>
            </div>

            <div className="flex flex-wrap gap-3">
              <Form method="post">
                <button
                  className="button-primary"
                  disabled={isJoining}
                  type="submit"
                >
                  {isJoining
                    ? t("public.joinInvite.joining")
                    : session
                      ? t("public.joinInvite.joinSpace")
                      : t("public.joinInvite.loginToJoin")}
                </button>
              </Form>
              <Link className="button-secondary" to="/">
                {t("public.joinInvite.backHome")}
              </Link>
            </div>
          </div>
        ) : !errorMessage ? (
          <p className="mt-5 text-sm text-[var(--color-text-muted)]">
            {t("public.joinInvite.loadingPreview")}
          </p>
        ) : null}
      </section>
    </main>
  );
}
