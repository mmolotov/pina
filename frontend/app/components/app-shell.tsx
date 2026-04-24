import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import {
  Clock,
  FolderOpen,
  Heart,
  Image,
  LogOut,
  Map,
  Menu,
  Moon,
  Search,
  Shield,
  Sun,
  Trash2,
  Upload,
  Users,
  Video,
  X,
} from "lucide-react";
import { BrandLogo } from "~/components/brand-logo";
import { LanguageSwitcher } from "~/components/language-switcher";
import { getHealth, logout } from "~/lib/api";
import { formatBytes } from "~/lib/format";
import { type MessageKey, useI18n } from "~/lib/i18n";
import { useSession } from "~/lib/session";
import { useTheme } from "~/lib/theme";
import type { HealthResponse } from "~/types/api";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  to: string;
  label: MessageKey;
  icon: LucideIcon;
  isActive: (pathname: string, view: string | null) => boolean;
}

const navItems: NavItem[] = [
  {
    to: "/app/library",
    label: "shell.nav.photos",
    icon: Image,
    isActive: (pathname, view) =>
      pathname.startsWith("/app/library") &&
      (view === null || view === "everything" || view === "photos"),
  },
  {
    to: "/app/library?view=map",
    label: "shell.nav.map",
    icon: Map,
    isActive: (pathname, view) =>
      pathname.startsWith("/app/library") && view === "map",
  },
  {
    to: "/app/spaces",
    label: "shell.nav.spaces",
    icon: Users,
    isActive: (pathname) => pathname.startsWith("/app/spaces"),
  },
  {
    to: "/app/library?view=albums",
    label: "shell.nav.albums",
    icon: FolderOpen,
    isActive: (pathname, view) =>
      pathname.startsWith("/app/library") && view === "albums",
  },
  {
    to: "/app/favorites",
    label: "shell.nav.favorites",
    icon: Heart,
    isActive: (pathname) => pathname.startsWith("/app/favorites"),
  },
  {
    to: "/app/videos",
    label: "shell.nav.videos",
    icon: Video,
    isActive: (pathname) => pathname.startsWith("/app/videos"),
  },
  {
    to: "/app/recent",
    label: "shell.nav.recent",
    icon: Clock,
    isActive: (pathname) => pathname.startsWith("/app/recent"),
  },
  {
    to: "/app/trash",
    label: "shell.nav.trash",
    icon: Trash2,
    isActive: (pathname) => pathname.startsWith("/app/trash"),
  },
];

type BackendStatus = "loading" | "up" | "down";

function buildSearchTarget(query: string) {
  if (query.length === 0) {
    return "/app/search";
  }

  const params = new URLSearchParams();
  params.set("q", query);
  return `/app/search?${params.toString()}`;
}

function getUserInitials(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return "PI";
  }

  const parts = normalized.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "PI";
}

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSession();
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [backendHealth, setBackendHealth] = useState<HealthResponse | null>(
    null,
  );
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("loading");

  const currentView = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("view");
  }, [location.search]);
  const isInstanceAdmin =
    session?.user.instanceRole === "ADMIN" && session.user.active !== false;
  const storageSummary = backendHealth
    ? t("shell.system.usedSuffix", {
        value: formatBytes(backendHealth.storage.usedBytes),
      })
    : null;

  useEffect(() => {
    let cancelled = false;

    getHealth()
      .then((response) => {
        if (cancelled) {
          return;
        }

        setBackendHealth(response);
        setBackendStatus("up");
      })
      .catch(() => {
        if (!cancelled) {
          setBackendStatus("down");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (location.pathname === "/app/search") {
      setSearchQuery(params.get("q") ?? "");
      return;
    }

    setSearchQuery("");
  }, [location.pathname, location.search]);

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(buildSearchTarget(searchQuery.trim()));
  }

  function closeMobileNav() {
    setIsMobileNavOpen(false);
  }

  useEffect(() => {
    if (!isMobileNavOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeMobileNav();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isMobileNavOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      {isMobileNavOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={closeMobileNav}
          role="presentation"
        />
      ) : null}

      <aside
        id="mobile-sidebar"
        role={isMobileNavOpen ? "dialog" : undefined}
        aria-modal={isMobileNavOpen ? true : undefined}
        className={[
          "sidebar fixed inset-y-0 left-0 z-40 flex w-60 flex-col transition-transform duration-200 lg:relative lg:translate-x-0",
          isMobileNavOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-16 items-center gap-3 border-b border-[var(--color-sidebar-border)] px-4">
          <Link to="/app/library" onClick={closeMobileNav}>
            <BrandLogo
              alt="PINA"
              className="h-7 w-auto max-w-[7rem] object-contain"
            />
          </Link>
          <button
            aria-label={t("shell.navigation.close")}
            className="ml-auto rounded-md p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] lg:hidden"
            onClick={closeMobileNav}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        <nav
          aria-label="Primary navigation"
          className="flex-1 space-y-1 overflow-y-auto px-3 py-3"
        >
          {navItems.map((item) => {
            const active = item.isActive(location.pathname, currentView);
            const IconComponent = item.icon;

            return (
              <Link
                key={item.to}
                className={[
                  "nav-link",
                  active ? "nav-link-active" : "nav-link-idle",
                ].join(" ")}
                to={item.to}
                onClick={closeMobileNav}
              >
                <IconComponent size={20} />
                <span>{t(item.label)}</span>
              </Link>
            );
          })}
          {isInstanceAdmin ? (
            <Link
              className={[
                "nav-link",
                location.pathname.startsWith("/app/admin")
                  ? "nav-link-active"
                  : "nav-link-idle",
              ].join(" ")}
              to="/app/admin"
              onClick={closeMobileNav}
            >
              <Shield size={20} />
              <span>{t("shell.nav.admin")}</span>
            </Link>
          ) : null}
        </nav>

        <div className="border-t border-[var(--color-sidebar-border)] px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span
              className={[
                "status-dot",
                backendStatus === "loading"
                  ? "status-dot-loading"
                  : backendStatus === "up"
                    ? "status-dot-up"
                    : "status-dot-down",
              ].join(" ")}
            />
            {storageSummary ? (
              <span>{storageSummary}</span>
            ) : (
              <span>{t("shell.system.storageInfoPending")}</span>
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="header-bar flex h-16 shrink-0 items-center gap-3 px-4">
          <button
            aria-expanded={isMobileNavOpen}
            aria-controls="mobile-sidebar"
            aria-label={
              isMobileNavOpen
                ? t("shell.navigation.close")
                : t("shell.navigation.open")
            }
            className="rounded-md p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] lg:hidden"
            onClick={() => {
              setIsMobileNavOpen((current) => !current);
            }}
            type="button"
          >
            <Menu size={20} />
          </button>

          <form
            className="mx-auto flex-1"
            onSubmit={handleSearchSubmit}
            role="search"
            style={{ maxWidth: "42rem" }}
          >
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                size={18}
              />
              <label className="sr-only" htmlFor="shell-search">
                {t("shell.search.label")}
              </label>
              <input
                className="search-field"
                id="shell-search"
                name="q"
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                }}
                placeholder={t("shell.search.placeholder")}
                type="search"
                value={searchQuery}
              />
            </div>
          </form>

          <div className="flex items-center gap-1">
            <Link
              aria-label={t("shell.upload")}
              className="rounded-md p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
              to="/app/library"
            >
              <Upload size={20} />
            </Link>
            <LanguageSwitcher />
            <button
              aria-label={
                theme === "light"
                  ? t("shell.theme.switchToDark")
                  : t("shell.theme.switchToLight")
              }
              className="rounded-md p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
              onClick={toggleTheme}
              type="button"
            >
              {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <Link
              className="rounded-md p-1 hover:bg-[var(--color-surface-hover)]"
              to="/app/settings"
            >
              <span className="avatar-token">
                {getUserInitials(session?.user.name)}
              </span>
            </Link>
            <button
              aria-label={t("shell.logout")}
              className="rounded-md p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
              onClick={handleLogout}
              type="button"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
