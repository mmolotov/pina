import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  SurfaceCard,
} from "~/components/ui";
import { getCurrentUser } from "~/lib/api";
import { updateSessionUser, useSession } from "~/lib/session";

interface AdminNavItem {
  to: string;
  label: string;
}

const adminNavItems: AdminNavItem[] = [
  { to: "/app/admin/users", label: "Users" },
  { to: "/app/admin/spaces", label: "Spaces" },
  { to: "/app/admin/invites", label: "Invites" },
  { to: "/app/admin/storage", label: "Storage" },
  { to: "/app/admin/health", label: "Health" },
  { to: "/app/admin/settings", label: "Settings" },
];

type CapabilityState = "loading" | "allowed" | "denied";

function isInstanceAdmin(role: string | null | undefined) {
  return role === "ADMIN";
}

export default function AppAdminLayoutRoute() {
  const location = useLocation();
  const session = useSession();
  const [capabilityState, setCapabilityState] = useState<CapabilityState>(
    () => {
      if (!session?.user) {
        return "denied";
      }

      if (
        typeof session.user.instanceRole === "string" &&
        typeof session.user.active === "boolean"
      ) {
        return session.user.active && isInstanceAdmin(session.user.instanceRole)
          ? "allowed"
          : "denied";
      }

      return "loading";
    },
  );

  useEffect(() => {
    if (!session?.user) {
      setCapabilityState("denied");
      return;
    }

    if (
      typeof session.user.instanceRole === "string" &&
      typeof session.user.active === "boolean"
    ) {
      setCapabilityState(
        session.user.active && isInstanceAdmin(session.user.instanceRole)
          ? "allowed"
          : "denied",
      );
      return;
    }

    let cancelled = false;
    setCapabilityState("loading");

    getCurrentUser()
      .then((user) => {
        if (cancelled) {
          return;
        }

        updateSessionUser(user);
        setCapabilityState(
          user.active && isInstanceAdmin(user.instanceRole)
            ? "allowed"
            : "denied",
        );
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setCapabilityState("denied");
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  const activeSection = useMemo(
    () =>
      adminNavItems.find((item) => location.pathname.startsWith(item.to)) ??
      adminNavItems[0],
    [location.pathname],
  );

  if (capabilityState === "loading") {
    return (
      <div className="space-y-8">
        <PageHeader
          description="Checking instance-admin capability before opening the administration surface."
          eyebrow="Admin"
          title="Loading admin access"
        />

        <section className="grid gap-6 xl:grid-cols-[14rem_minmax(0,1fr)]">
          <Panel className="p-3">
            <div className="space-y-1">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  className="surface-card-subtle h-10 rounded-lg"
                  key={`admin-nav-skeleton-${index}`}
                />
              ))}
            </div>
          </Panel>
          <Panel className="p-6">
            <div className="surface-card-subtle h-64 rounded-lg" />
          </Panel>
        </section>
      </div>
    );
  }

  if (capabilityState === "denied") {
    return (
      <div className="space-y-8">
        <PageHeader
          actions={
            <Link className="button-secondary" to="/app/library">
              Return to library
            </Link>
          }
          description="Instance administration is reserved for users with the backend-confirmed admin role."
          eyebrow="Admin"
          title="Access denied"
        />

        <EmptyState
          action={
            <Link className="button-primary" to="/app/settings">
              Open profile settings
            </Link>
          }
          description="Your current account does not have instance-admin capability. If this is unexpected, ask an existing admin to review your instance role."
          title="You do not have admin access"
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        actions={
          <>
            <Link className="button-secondary" to="/app/library">
              Open library
            </Link>
            <Link
              className="button-primary"
              to={activeSection?.to ?? "/app/admin/users"}
            >
              Open current section
            </Link>
          </>
        }
        description="Instance-wide administration surface for users, Spaces, invites, storage, health, and mutable settings."
        eyebrow="Admin"
        title="Instance control"
      />

      <section className="grid gap-6 xl:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Panel className="p-3">
            <div className="space-y-1" aria-label="Admin navigation">
              {adminNavItems.map((item) => {
                const isActive = location.pathname.startsWith(item.to);

                return (
                  <Link
                    className={[
                      "nav-link",
                      isActive ? "nav-link-active" : "nav-link-idle",
                    ].join(" ")}
                    key={item.to}
                    to={item.to}
                  >
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </Panel>

          <SurfaceCard className="rounded-lg p-4" tone="subtle">
            <p className="eyebrow">Access scope</p>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Instance-wide administration
            </p>
            <Badge
              className="mt-3 rounded-full px-3 py-1 text-xs font-semibold"
              tone="accent"
            >
              instance admin
            </Badge>
          </SurfaceCard>
        </aside>

        <div className="min-w-0">
          <Outlet />
        </div>
      </section>
    </div>
  );
}
