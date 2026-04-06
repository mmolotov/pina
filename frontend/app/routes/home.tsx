import { Link, Navigate } from "react-router";
import type { Route } from "./+types/home";
import { useEffect, useState } from "react";
import { BrandLogo } from "~/components/brand-logo";
import { LanguageSwitcher } from "~/components/language-switcher";
import { getHealth } from "~/lib/api";
import { useI18n } from "~/lib/i18n";
import { useSession } from "~/lib/session";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "PINA" },
    { name: "description", content: "Private Image Network Archive" },
  ];
}

type HealthStatus = "loading" | "up" | "down";

export default function Home() {
  const session = useSession();
  const { t } = useI18n();
  const [health, setHealth] = useState<HealthStatus>("loading");

  useEffect(() => {
    getHealth()
      .then(() => {
        setHealth("up");
      })
      .catch(() => {
        setHealth("down");
      });
  }, []);

  if (session) {
    return <Navigate to="/app/library" replace />;
  }

  return (
    <main className="app-shell min-h-screen px-6 py-10 lg:px-10">
      <div className="flex min-h-[calc(100vh-5rem)] w-full flex-col gap-8 lg:justify-between">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">{t("public.home.phaseEyebrow")}</p>
            <BrandLogo
              alt="PINA"
              className="mt-3 h-12 w-auto max-w-[12rem] object-contain sm:h-14"
            />
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link className="button-secondary" to="/login">
              {t("public.home.login")}
            </Link>
            <Link className="button-primary" to="/register">
              {t("public.home.createAccount")}
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <article className="panel p-8 sm:p-10">
            <p className="eyebrow">{t("public.home.heroEyebrow")}</p>
            <h2 className="mt-4 max-w-3xl text-5xl leading-tight font-semibold tracking-tight sm:text-6xl">
              {t("public.home.heroTitle")}
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--color-text-muted)]">
              {t("public.home.heroDescription")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="button-primary" to="/register">
                {t("public.home.heroPrimaryCta")}
              </Link>
              <Link className="button-secondary" to="/login">
                {t("public.home.heroSecondaryCta")}
              </Link>
            </div>
          </article>

          <aside className="panel flex flex-col justify-between p-8">
            <div>
              <p className="eyebrow">{t("public.home.environmentEyebrow")}</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight">
                {t("public.home.environmentTitle")}
              </h3>
              <div className="surface-card mt-5 inline-flex items-center gap-3 rounded-full px-4 py-3 text-sm text-[var(--color-text-muted)]">
                <span
                  className={[
                    "status-dot",
                    health === "loading"
                      ? "status-dot-loading"
                      : health === "up"
                        ? "status-dot-up"
                        : "status-dot-down",
                  ].join(" ")}
                />
                <span>
                  {health === "loading"
                    ? t("public.home.backendConnecting")
                    : health === "up"
                      ? t("public.home.backendConnected")
                      : t("public.home.backendUnavailable")}
                </span>
              </div>
            </div>

            <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="surface-card rounded-2xl p-4">
                <dt className="eyebrow">
                  {t("public.home.readyTodayEyebrow")}
                </dt>
                <dd className="mt-2 text-sm leading-7 text-[var(--color-text-muted)]">
                  {t("public.home.readyTodayDescription")}
                </dd>
              </div>
              <div className="surface-card rounded-2xl p-4">
                <dt className="eyebrow">
                  {t("public.home.nextFrontendEyebrow")}
                </dt>
                <dd className="mt-2 text-sm leading-7 text-[var(--color-text-muted)]">
                  {t("public.home.nextFrontendDescription")}
                </dd>
              </div>
            </dl>
          </aside>
        </section>
      </div>
    </main>
  );
}
