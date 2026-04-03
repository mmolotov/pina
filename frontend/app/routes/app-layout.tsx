import { Navigate, useLocation } from "react-router";
import { useEffect } from "react";
import { AppShell } from "~/components/app-shell";
import { getCurrentUser } from "~/lib/api";
import { updateSessionUser, useSession } from "~/lib/session";

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
