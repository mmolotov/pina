import { useEffect, useMemo, useState } from "react";
import {
  Form,
  Link,
  Navigate,
  useActionData,
  useLocation,
  useNavigate,
  useNavigation,
} from "react-router";
import type { Route } from "./+types/login";
import { BrandLogo } from "~/components/brand-logo";
import { LanguageSwitcher } from "~/components/language-switcher";
import { InlineMessage, SurfaceCard } from "~/components/ui";
import { login } from "~/lib/api";
import { getActiveLocale, translateMessage, useI18n } from "~/lib/i18n";
import { getRedirectTarget, toActionErrorMessage } from "~/lib/route-actions";
import { persistSession, useSession } from "~/lib/session";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Log In | PINA" }];
}

type LoginActionResult =
  | { ok: true; redirectTo: string }
  | { ok: false; errorMessage: string };

export async function clientAction({
  request,
}: Route.ClientActionArgs): Promise<LoginActionResult> {
  const formData = await request.formData();
  const redirectTo = getRedirectTarget(request, "/app/library");

  try {
    const authResponse = await login({
      username: String(formData.get("username") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    });
    persistSession(authResponse);
    return { ok: true, redirectTo };
  } catch (error) {
    return {
      ok: false,
      errorMessage: toActionErrorMessage(
        error,
        translateMessage(getActiveLocale(), "public.login.errorFallback"),
      ),
    };
  }
}

export default function LoginRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSession();
  const { t } = useI18n();
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const redirectTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("redirect") || "/app/library";
  }, [location.search]);
  const [formState, setFormState] = useState({ username: "", password: "" });

  useEffect(() => {
    if (actionData?.ok) {
      navigate(actionData.redirectTo, { replace: true });
    }
  }, [actionData, navigate]);

  if (session) {
    return <Navigate to={redirectTo} replace />;
  }

  const errorMessage =
    actionData && !actionData.ok ? actionData.errorMessage : null;
  const isSubmitting = navigation.state !== "idle";

  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-6 py-10">
      <section className="panel w-full max-w-2xl p-8 sm:p-10">
        <div className="flex items-start justify-between gap-4">
          <p className="eyebrow">{t("public.login.eyebrow")}</p>
          <LanguageSwitcher />
        </div>
        <BrandLogo
          alt="PINA"
          className="mt-4 h-12 w-auto max-w-[12rem] object-contain"
        />
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          {t("public.login.title")}
        </h1>
        <p className="mt-3 text-base leading-7 text-[var(--color-text-muted)]">
          {t("public.login.description")}
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <Form className="space-y-5" method="post">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">
                {t("public.login.username")}
              </span>
              <input
                className="field"
                name="username"
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    username: event.target.value,
                  }))
                }
                placeholder="manual_user_a"
                required
                value={formState.username}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium">
                {t("public.login.password")}
              </span>
              <input
                className="field"
                name="password"
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                required
                type="password"
                value={formState.password}
              />
            </label>

            {errorMessage ? (
              <InlineMessage tone="danger">{errorMessage}</InlineMessage>
            ) : null}

            <button
              className="button-primary w-full"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting
                ? t("public.login.submitting")
                : t("public.login.submit")}
            </button>
          </Form>

          <SurfaceCard className="rounded-3xl p-5">
            <p className="eyebrow">{t("public.login.sessionTargetEyebrow")}</p>
            <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
              {t("public.login.redirectDescription", {
                redirectTo,
              })}
            </p>
            <p className="mt-4 text-sm leading-7 text-[var(--color-text-muted)]">
              {t("public.login.backendDescription")}
            </p>
          </SurfaceCard>
        </div>

        <p className="mt-6 text-sm text-[var(--color-text-muted)]">
          {t("public.login.needAccount")}{" "}
          <Link className="link-accent font-semibold" to="/register">
            {t("public.login.createOne")}
          </Link>
        </p>
      </section>
    </main>
  );
}
