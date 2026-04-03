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

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
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
          <pre className="max-h-96 overflow-auto rounded-2xl bg-[var(--color-panel-strong)] p-4 text-xs text-[var(--color-text-muted)]">
            <code>{stack}</code>
          </pre>
        )}
      </section>
    </main>
  );
}
