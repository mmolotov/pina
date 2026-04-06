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
import type { Route } from "./+types/register";
import { BrandLogo } from "~/components/brand-logo";
import { LanguageSwitcher } from "~/components/language-switcher";
import { InlineMessage, SurfaceCard } from "~/components/ui";
import { register } from "~/lib/api";
import { getActiveLocale, translateMessage, useI18n } from "~/lib/i18n";
import { getRedirectTarget, toActionErrorMessage } from "~/lib/route-actions";
import { persistSession, useSession } from "~/lib/session";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Register | PINA" }];
}

type RegisterActionResult =
  | { ok: true; redirectTo: string }
  | { ok: false; errorMessage: string };

export async function clientAction({
  request,
}: Route.ClientActionArgs): Promise<RegisterActionResult> {
  const formData = await request.formData();
  const redirectTo = getRedirectTarget(request, "/app/library");

  try {
    const authResponse = await register({
      username: String(formData.get("username") ?? "").trim(),
      name: String(formData.get("name") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    });
    persistSession(authResponse);
    return { ok: true, redirectTo };
  } catch (error) {
    return {
      ok: false,
      errorMessage: toActionErrorMessage(
        error,
        translateMessage(getActiveLocale(), "public.register.errorFallback"),
      ),
    };
  }
}

export default function RegisterRoute() {
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
  const [formState, setFormState] = useState({
    username: "",
    name: "",
    password: "",
  });

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
          <p className="eyebrow">{t("public.register.eyebrow")}</p>
          <LanguageSwitcher />
        </div>
        <BrandLogo
          alt="PINA"
          className="mt-4 h-12 w-auto max-w-[12rem] object-contain"
        />
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          {t("public.register.title")}
        </h1>
        <p className="mt-3 text-base leading-7 text-[var(--color-text-muted)]">
          {t("public.register.description")}
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <Form className="space-y-5" method="post">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">
                {t("public.register.name")}
              </span>
              <input
                className="field"
                name="name"
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Manual User A"
                required
                value={formState.name}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium">
                {t("public.register.username")}
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
                {t("public.register.password")}
              </span>
              <input
                className="field"
                minLength={8}
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
                ? t("public.register.submitting")
                : t("public.register.submit")}
            </button>
          </Form>

          <SurfaceCard className="rounded-3xl p-5">
            <p className="eyebrow">{t("public.register.nextEyebrow")}</p>
            <ul className="mt-3 space-y-3 text-sm leading-7 text-[var(--color-text-muted)]">
              <li>{t("public.register.nextCreated")}</li>
              <li>{t("public.register.nextRedirect", { redirectTo })}</li>
              <li>{t("public.register.nextScope")}</li>
            </ul>
          </SurfaceCard>
        </div>

        <p className="mt-6 text-sm text-[var(--color-text-muted)]">
          {t("public.register.haveAccount")}{" "}
          <Link className="link-accent font-semibold" to="/login">
            {t("public.register.login")}
          </Link>
        </p>
      </section>
    </main>
  );
}
