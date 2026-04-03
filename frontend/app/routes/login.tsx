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
import { login } from "~/lib/api";
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
  const redirectTo = getRedirectTarget(request, "/app");

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
        "Login failed. Please try again.",
      ),
    };
  }
}

export default function LoginRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSession();
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const redirectTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("redirect") || "/app";
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
        <p className="eyebrow">Authentication</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Log in to PINA
        </h1>
        <p className="mt-3 text-base leading-7 text-[var(--color-text-muted)]">
          Use your existing local account to enter the app shell.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <Form className="space-y-5" method="post">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Username</span>
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
              <span className="mb-2 block text-sm font-medium">Password</span>
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
              <p className="rounded-2xl border border-[rgba(161,69,63,0.25)] bg-[rgba(161,69,63,0.08)] px-4 py-3 text-sm text-[var(--color-danger)]">
                {errorMessage}
              </p>
            ) : null}

            <button
              className="button-primary w-full"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Logging in..." : "Log in"}
            </button>
          </Form>

          <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-panel-strong)] p-5">
            <p className="eyebrow">Session target</p>
            <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
              After authentication you will be redirected to{" "}
              <span className="font-semibold text-[var(--color-text)]">
                {redirectTo}
              </span>
              .
            </p>
            <p className="mt-4 text-sm leading-7 text-[var(--color-text-muted)]">
              Local username/password auth is already connected to the Phase 2
              backend. Google sign-in can be added on top later.
            </p>
          </div>
        </div>

        <p className="mt-6 text-sm text-[var(--color-text-muted)]">
          Need an account?{" "}
          <Link
            className="font-semibold text-[var(--color-primary-strong)]"
            to="/register"
          >
            Create one
          </Link>
        </p>
      </section>
    </main>
  );
}
