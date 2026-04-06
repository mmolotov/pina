import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { ReactNode } from "react";

import type { Route } from "./+types/root";
import "./app.css";
import { BrandLogo } from "~/components/brand-logo";
import { isBackendUnavailableError } from "~/lib/api";
import { I18nProvider, localeBootstrapScript } from "~/lib/i18n";
import { ThemeProvider, themeBootstrapScript } from "~/lib/theme";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html data-locale="en" lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: localeBootstrapScript }} />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <Meta />
        <Links />
      </head>
      <body>
        <I18nProvider>
          <ThemeProvider>
            {children}
            <ScrollRestoration />
            <Scripts />
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isBackendUnavailableError(error)) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center px-6 py-10">
        <section className="panel w-full max-w-3xl space-y-5 p-8 sm:p-10">
          <p className="eyebrow">Backend Connection</p>
          <BrandLogo
            alt="PINA"
            className="h-12 w-auto max-w-[12rem] object-contain"
          />
          <h1 className="text-4xl font-semibold tracking-tight">
            Backend is unavailable
          </h1>
          <p className="max-w-2xl text-base leading-7 text-[var(--color-text-muted)]">
            The app could not connect to the API. Check that the backend is
            running and reachable, then try again.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              className="button-primary"
              onClick={() => window.location.reload()}
              type="button"
            >
              Retry
            </button>
            <a className="button-secondary" href="/">
              Open home
            </a>
          </div>
        </section>
      </main>
    );
  }

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-6 py-10">
      <section className="panel max-w-3xl space-y-4 p-8">
        <p className="eyebrow">Application Error</p>
        <h1 className="text-4xl font-semibold tracking-tight">{message}</h1>
        <p className="max-w-2xl text-base text-[var(--color-text-muted)]">
          {details}
        </p>
        {stack && (
          <pre className="surface-card max-h-96 overflow-auto rounded-2xl p-4 text-xs text-[var(--color-text-muted)]">
            <code>{stack}</code>
          </pre>
        )}
      </section>
    </main>
  );
}
