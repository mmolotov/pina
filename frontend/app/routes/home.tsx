import { Link, Navigate } from "react-router";
import type { Route } from "./+types/home";
import { useEffect, useState } from "react";
import { getHealth } from "~/lib/api";
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
    return <Navigate to="/app" replace />;
  }

  return (
    <main className="app-shell min-h-screen px-6 py-10 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col gap-8 lg:justify-between">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Phase 3 Foundation</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              PINA
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link className="button-secondary" to="/login">
              Log in
            </Link>
            <Link className="button-primary" to="/register">
              Create account
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <article className="panel p-8 sm:p-10">
            <p className="eyebrow">Private Image Network Archive</p>
            <h2 className="mt-4 max-w-3xl text-5xl leading-tight font-semibold tracking-tight sm:text-6xl">
              A collaboration-ready media library, starting with auth, photos,
              albums, and Spaces.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--color-text-muted)]">
              The backend is already on Phase 2. This frontend foundation starts
              the real app shell: authentication, personal library access, and
              Space-aware navigation.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="button-primary" to="/register">
                Start with a local account
              </Link>
              <Link className="button-secondary" to="/login">
                Open the app
              </Link>
            </div>
          </article>

          <aside className="panel flex flex-col justify-between p-8">
            <div>
              <p className="eyebrow">Environment</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight">
                Backend status
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
                    ? "Connecting to backend"
                    : health === "up"
                      ? "Backend connected"
                      : "Backend unavailable"}
                </span>
              </div>
            </div>

            <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="surface-card rounded-2xl p-4">
                <dt className="eyebrow">Ready today</dt>
                <dd className="mt-2 text-sm leading-7 text-[var(--color-text-muted)]">
                  JWT auth, refresh tokens, Google login, Spaces, invite links,
                  shared albums, favorites.
                </dd>
              </div>
              <div className="surface-card rounded-2xl p-4">
                <dt className="eyebrow">Next in frontend</dt>
                <dd className="mt-2 text-sm leading-7 text-[var(--color-text-muted)]">
                  Library browsing, album flows, Space dashboards, and
                  responsive app navigation.
                </dd>
              </div>
            </dl>
          </aside>
        </section>
      </div>
    </main>
  );
}
