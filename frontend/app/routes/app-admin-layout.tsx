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
  description: string;
}

const adminNavItems: AdminNavItem[] = [
  {
    to: "/app/admin/users",
    label: "Users",
    description: "Instance-wide user management and account status.",
  },
  {
    to: "/app/admin/spaces",
    label: "Spaces",
    description: "Global Space oversight and moderation entrypoint.",
  },
  {
    to: "/app/admin/invites",
    label: "Invites",
    description: "Instance-wide invite oversight and revocation.",
  },
  {
    to: "/app/admin/storage",
    label: "Storage",
    description: "Capacity, usage summary, and per-owner breakdowns.",
  },
  {
    to: "/app/admin/health",
    label: "Health",
    description: "Operational backend and dependency visibility.",
  },
  {
    to: "/app/admin/settings",
    label: "Settings",
    description: "Mutable instance settings and registration controls.",
  },
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

        <section className="grid gap-6 xl:grid-cols-[16rem_minmax(0,1fr)]">
          <Panel className="p-5">
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  className="surface-card-subtle h-16 rounded-2xl"
                  key={`admin-nav-skeleton-${index}`}
                />
              ))}
            </div>
          </Panel>
          <Panel className="p-8">
            <div className="surface-card-subtle h-64 rounded-3xl" />
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

      <section className="grid gap-6 xl:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Panel className="p-4">
            <div className="space-y-2" aria-label="Admin navigation">
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
                    <span className="block text-sm font-semibold">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-xs text-inherit/80">
                      {item.description}
                    </span>
                  </Link>
                );
              })}
            </div>
          </Panel>

          <SurfaceCard className="rounded-3xl p-5" tone="subtle">
            <p className="eyebrow">Access scope</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">
              Global administration
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
              These screens are instance-wide and intentionally separate from
              the normal user-facing library and Space flows.
            </p>
            <Badge
              className="mt-4 rounded-full px-3 py-1 text-xs font-semibold"
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
