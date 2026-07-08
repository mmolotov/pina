import { Navigate, redirect, useLocation } from "react-router";
import { useEffect } from "react";
import type { Route } from "./+types/app-layout";
import { AppShell } from "~/components/app-shell";
import { getCurrentUser } from "~/lib/api";
import {
  getSessionSnapshot,
  updateSessionUser,
  useSession,
} from "~/lib/session";

// Child route clientLoaders run before the component tree renders, so an
// anonymous deep link (e.g. /app/library) would hit their 401s and land in
// the root error boundary before the render guard below ever mounts. Guard
// in a loader instead: a loader redirect takes precedence over sibling
// loader errors, so the visitor reaches /login with a return path.
export function clientLoader({ request }: Route.ClientLoaderArgs) {
  if (!getSessionSnapshot()) {
    const url = new URL(request.url);
    const returnTo = `${url.pathname}${url.search}`;
    throw redirect(`/login?redirect=${encodeURIComponent(returnTo)}`);
  }
  return null;
}

export default function AppLayoutRoute() {
  const location = useLocation();
  const session = useSession();
  const accessToken = session?.accessToken ?? null;

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    getCurrentUser()
      .then((user) => {
        updateSessionUser(user);
      })
      .catch(() => {
        return;
      });
  }, [accessToken]);

  if (!session) {
    const redirect = `${location.pathname}${location.search}`;
    return (
      <Navigate
        replace
        to={`/login?redirect=${encodeURIComponent(redirect)}`}
      />
    );
  }

  return <AppShell />;
}
