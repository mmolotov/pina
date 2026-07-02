import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import {
  Activity,
  ExternalLink,
  HardDrive,
  Layers,
  Link2,
  Settings,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ABadge } from "~/components/admin/ui";
import { fmtNum } from "~/lib/admin-format";
import {
  getCurrentUser,
  listAdminInvites,
  listAdminSpaces,
  listAdminUsers,
} from "~/lib/api";
import { useI18n, type MessageKey } from "~/lib/i18n";
import { updateSessionUser, useSession } from "~/lib/session";

type CountKey = "users" | "spaces" | "invites";

interface AdminNavItem {
  to: string;
  labelKey: MessageKey;
  Icon: LucideIcon;
  countKey?: CountKey;
}

const ADMIN_NAV: AdminNavItem[] = [
  {
    to: "/app/admin/users",
    labelKey: "app.admin.nav.users",
    Icon: Users,
    countKey: "users",
  },
  {
    to: "/app/admin/spaces",
    labelKey: "app.admin.nav.spaces",
    Icon: Layers,
    countKey: "spaces",
  },
  {
    to: "/app/admin/invites",
    labelKey: "app.admin.nav.invites",
    Icon: Link2,
    countKey: "invites",
  },
  {
    to: "/app/admin/storage",
    labelKey: "app.admin.nav.storage",
    Icon: HardDrive,
  },
  { to: "/app/admin/health", labelKey: "app.admin.nav.health", Icon: Activity },
  {
    to: "/app/admin/settings",
    labelKey: "app.admin.nav.settings",
    Icon: Settings,
  },
];

type CapabilityState = "loading" | "allowed" | "denied";
type Counts = Record<CountKey, number | null>;

function isInstanceAdmin(role: string | null | undefined) {
  return role === "ADMIN";
}

function AdminHeader({ activeLabel }: { activeLabel: string }) {
  const { t } = useI18n();
  return (
    <div className="adm-head">
      <div>
        <p className="eyebrow">{t("app.admin.eyebrow")}</p>
        <h1 className="adm-head-title">{t("app.admin.title")}</h1>
        <p className="adm-head-lede">{t("app.admin.lede")}</p>
      </div>
      <div className="adm-head-actions">
        <Link className="button-secondary btn-sm" to="/app/library">
          <ExternalLink size={15} /> {t("app.admin.openLibrary")}
        </Link>
        <span className="adm-badge accent" style={{ padding: ".4rem .75rem" }}>
          {activeLabel}
        </span>
      </div>
    </div>
  );
}

export default function AppAdminLayoutRoute() {
  const { t } = useI18n();
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
  const [counts, setCounts] = useState<Counts>({
    users: null,
    spaces: null,
    invites: null,
  });

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

  // Best-effort per-section counts for the nav badges.
  useEffect(() => {
    if (capabilityState !== "allowed") {
      return;
    }

    let cancelled = false;
    Promise.allSettled([
      listAdminUsers({ page: 0, size: 1, needsTotal: true }),
      listAdminSpaces({ page: 0, size: 1, needsTotal: true }),
      listAdminInvites({ page: 0, size: 1, needsTotal: true }),
    ]).then((results) => {
      if (cancelled) {
        return;
      }
      const [users, spaces, invites] = results;
      setCounts({
        users:
          users.status === "fulfilled"
            ? (users.value.totalItems ?? null)
            : null,
        spaces:
          spaces.status === "fulfilled"
            ? (spaces.value.totalItems ?? null)
            : null,
        invites:
          invites.status === "fulfilled"
            ? (invites.value.totalItems ?? null)
            : null,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [capabilityState]);

  const activeItem = useMemo(
    () =>
      ADMIN_NAV.find((item) => location.pathname.startsWith(item.to)) ??
      ADMIN_NAV[0]!,
    [location.pathname],
  );

  if (capabilityState === "loading") {
    return (
      <div className="adm" data-screen-label="Admin">
        <AdminHeader activeLabel={t("app.admin.loadingTitle")} />
        <div className="adm-body">
          <div className="adm-nav">
            <div className="adm-nav-panel">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  className="adm-skel-row skel"
                  key={index}
                  style={{
                    height: "2.1rem",
                    borderRadius: ".75rem",
                    margin: ".125rem",
                  }}
                />
              ))}
            </div>
          </div>
          <div className="adm-content">
            <div className="adm-card">
              <div
                className="adm-skel-row skel"
                style={{ height: "12rem", borderRadius: "1rem" }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (capabilityState === "denied") {
    return (
      <div className="adm" data-screen-label="Admin — Denied">
        <div className="adm-denied">
          <div className="adm-denied-ico">
            <Shield size={32} />
          </div>
          <h2>{t("app.admin.deniedTitle")}</h2>
          <p>{t("app.admin.deniedText")}</p>
          <Link
            className="button-primary"
            style={{ marginTop: ".5rem" }}
            to="/app/library"
          >
            {t("app.admin.backToLibrary")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="adm" data-screen-label="Admin">
      <AdminHeader activeLabel={t(activeItem.labelKey)} />

      <div className="adm-body">
        <nav aria-label={t("app.admin.title")} className="adm-nav">
          <div className="adm-nav-panel">
            {ADMIN_NAV.map((item) => {
              const active = location.pathname.startsWith(item.to);
              const count = item.countKey ? counts[item.countKey] : null;
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`adm-nav-link${active ? " active" : ""}`}
                  key={item.to}
                  to={item.to}
                >
                  <item.Icon size={17} />
                  <span>{t(item.labelKey)}</span>
                  {count != null ? (
                    <span className="adm-nav-count">{fmtNum(count)}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>

          <div className="adm-scope">
            <div className="adm-scope-row">
              <span className="adm-scope-ico">
                <Shield size={18} />
              </span>
              <div>
                <div className="adm-scope-name">{t("app.admin.scopeName")}</div>
                <div className="adm-scope-sub">{t("app.admin.scopeSub")}</div>
              </div>
            </div>
            <div style={{ marginTop: ".75rem" }}>
              <ABadge dot tone="accent">
                {t("app.admin.scopeBadge")}
              </ABadge>
            </div>
          </div>
        </nav>

        <div className="adm-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
