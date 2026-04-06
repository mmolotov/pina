import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { BrandLogo } from "~/components/brand-logo";
import { LanguageSwitcher } from "~/components/language-switcher";
import { getHealth, logout } from "~/lib/api";
import { formatBytes } from "~/lib/format";
import { type MessageKey, useI18n } from "~/lib/i18n";
import { useSession } from "~/lib/session";
import { useTheme } from "~/lib/theme";
import type { HealthResponse } from "~/types/api";

interface NavItem {
  to: string;
  label: MessageKey;
  caption: MessageKey;
  isActive: (pathname: string, view: string | null) => boolean;
}

interface QuickFilterLink {
  to: string;
  title: MessageKey;
  description: MessageKey;
}

const navItems: NavItem[] = [
  {
    to: "/app/library",
    label: "shell.nav.photos",
    caption: "shell.nav.photosCaption",
    isActive: (pathname, view) =>
      pathname.startsWith("/app/library") &&
      (view === null ||
        view === "everything" ||
        view === "photos" ||
        view === "timeline"),
  },
  {
    to: "/app/library?view=map",
    label: "shell.nav.map",
    caption: "shell.nav.mapCaption",
    isActive: (pathname, view) =>
      pathname.startsWith("/app/library") && view === "map",
  },
  {
    to: "/app/spaces",
    label: "shell.nav.spaces",
    caption: "shell.nav.spacesCaption",
    isActive: (pathname) => pathname.startsWith("/app/spaces"),
  },
  {
    to: "/app/library?view=albums",
    label: "shell.nav.albums",
    caption: "shell.nav.albumsCaption",
    isActive: (pathname, view) =>
      pathname.startsWith("/app/library") && view === "albums",
  },
  {
    to: "/app/favorites",
    label: "shell.nav.favorites",
    caption: "shell.nav.favoritesCaption",
    isActive: (pathname) => pathname.startsWith("/app/favorites"),
  },
  {
    to: "/app/videos",
    label: "shell.nav.videos",
    caption: "shell.nav.videosCaption",
    isActive: (pathname) => pathname.startsWith("/app/videos"),
  },
  {
    to: "/app/recent",
    label: "shell.nav.recent",
    caption: "shell.nav.recentCaption",
    isActive: (pathname) => pathname.startsWith("/app/recent"),
  },
  {
    to: "/app/trash",
    label: "shell.nav.trash",
    caption: "shell.nav.trashCaption",
    isActive: (pathname) => pathname.startsWith("/app/trash"),
  },
];

const quickFilterLinks: QuickFilterLink[] = [
  {
    to: "/app/library",
    title: "shell.quick.allPhotosTitle",
    description: "shell.quick.allPhotosDescription",
  },
  {
    to: "/app/library?view=timeline",
    title: "shell.quick.timelineTitle",
    description: "shell.quick.timelineDescription",
  },
  {
    to: "/app/library?view=map",
    title: "shell.quick.mapTitle",
    description: "shell.quick.mapDescription",
  },
  {
    to: "/app/library?view=albums",
    title: "shell.quick.albumsTitle",
    description: "shell.quick.albumsDescription",
  },
  {
    to: "/app/favorites",
    title: "shell.quick.favoritesTitle",
    description: "shell.quick.favoritesDescription",
  },
  {
    to: "/app/spaces",
    title: "shell.quick.spacesTitle",
    description: "shell.quick.spacesDescription",
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
  const { locale, t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
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
  const appVersion = import.meta.env.VITE_APP_VERSION ?? "dev";
  const storageSummary = backendHealth
    ? t("shell.system.usedSuffix", {
        value: formatBytes(backendHealth.storage.usedBytes),
      })
    : t("shell.system.storageInfoPending");
  const storageCapacity = backendHealth
    ? t("shell.system.availableSuffix", {
        value: formatBytes(backendHealth.storage.availableBytes),
      })
    : t("shell.system.waitingForBackend");
  const backendLabel =
    backendStatus === "loading"
      ? t("shell.system.checkingBackend")
      : backendStatus === "up"
        ? t("shell.system.backendConnected")
        : t("shell.system.backendUnavailable");

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
    setIsFilterPanelOpen(false);
  }

  return (
    <div className="app-shell min-h-screen px-3 py-3 sm:px-4 lg:px-6">
      <div className="mb-3 flex w-full items-center justify-between gap-3 lg:hidden">
        <Link className="panel flex-1 p-3" to="/app/library">
          <p className="eyebrow">{t("shell.mobileEyebrow")}</p>
          <BrandLogo
            alt="PINA"
            className="mt-2 h-10 w-auto max-w-[10rem] object-contain"
          />
        </Link>
        <div className="flex items-center gap-2">
          <Link className="button-primary px-4 py-3 text-sm" to="/app/library">
            {t("shell.upload")}
          </Link>
          <button
            aria-expanded={isMobileNavOpen}
            aria-label={
              isMobileNavOpen
                ? t("shell.navigation.close")
                : t("shell.navigation.open")
            }
            className="button-secondary"
            onClick={() => {
              setIsMobileNavOpen((current) => !current);
            }}
            type="button"
          >
            <span aria-hidden="true">☰</span>
            {isMobileNavOpen ? t("shell.menuClose") : t("shell.menuOpen")}
          </button>
        </div>
      </div>

      <div className="flex min-h-[calc(100vh-1.5rem)] w-full flex-col gap-3 lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <aside
          className={[
            "panel flex flex-col gap-6 p-4 sm:p-5",
            isMobileNavOpen ? "block" : "hidden lg:flex",
          ].join(" ")}
        >
          <Link className="surface-card rounded-[1.5rem] p-4" to="/app/library">
            <p className="eyebrow">{t("shell.brandEyebrow")}</p>
            <BrandLogo
              alt="PINA"
              className="mt-3 h-12 w-auto max-w-[11rem] object-contain"
            />
            <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
              {t("shell.brandDescription")}
            </p>
          </Link>

          <nav className="flex flex-col gap-2" aria-label="Primary navigation">
            {navItems.map((item) => (
              <Link
                key={item.to}
                className={[
                  "nav-link",
                  item.isActive(location.pathname, currentView)
                    ? "nav-link-active"
                    : "nav-link-idle",
                ].join(" ")}
                to={item.to}
                onClick={() => {
                  setIsMobileNavOpen(false);
                  setIsFilterPanelOpen(false);
                }}
              >
                <span className="block text-sm font-semibold">
                  {t(item.label)}
                </span>
                <span className="mt-1 block text-xs text-inherit/80">
                  {t(item.caption)}
                </span>
              </Link>
            ))}
            {isInstanceAdmin ? (
              <Link
                className={[
                  "nav-link",
                  location.pathname.startsWith("/app/admin")
                    ? "nav-link-active"
                    : "nav-link-idle",
                ].join(" ")}
                to="/app/admin"
                onClick={() => {
                  setIsMobileNavOpen(false);
                  setIsFilterPanelOpen(false);
                }}
              >
                <span className="block text-sm font-semibold">
                  {t("shell.nav.admin")}
                </span>
                <span className="mt-1 block text-xs text-inherit/80">
                  {t("shell.nav.adminCaption")}
                </span>
              </Link>
            ) : null}
          </nav>

          <div className="mt-auto space-y-3">
            <div className="surface-card-subtle rounded-[1.5rem] p-4">
              <p className="eyebrow">{t("shell.signedInEyebrow")}</p>
              <p className="mt-2 text-base font-semibold tracking-tight">
                {session?.user.name ?? t("shell.unknownUser")}
              </p>
              <p className="mt-1 break-all text-sm text-[var(--color-text-muted)]">
                {session?.user.email ?? t("shell.noEmailConfigured")}
              </p>
              <Link
                className="link-accent mt-4 inline-flex text-sm font-semibold"
                onClick={() => {
                  setIsMobileNavOpen(false);
                }}
                to="/app/settings"
              >
                {t("shell.manageAccount")}
              </Link>
            </div>

            <div className="surface-card rounded-[1.5rem] p-4">
              <p className="eyebrow">{t("shell.systemEyebrow")}</p>
              <div className="mt-3 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--color-text-muted)]">
                    {t("shell.system.backendLabel")}
                  </span>
                  <span className="inline-flex items-center gap-2 font-medium">
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
                    {backendLabel}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[var(--color-text-muted)]">
                    {t("shell.system.storageLabel")}
                  </span>
                  <span className="text-right font-medium">
                    <span className="block">{storageSummary}</span>
                    <span className="block text-xs text-[var(--color-text-muted)]">
                      {storageCapacity}
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--color-text-muted)]">
                    {t("shell.system.versionLabel")}
                  </span>
                  <span className="font-medium">web {appVersion}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="space-y-3">
          <header className="panel p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-1 items-center gap-3">
                <button
                  aria-expanded={isMobileNavOpen}
                  aria-label={
                    isMobileNavOpen
                      ? t("shell.navigation.close")
                      : t("shell.navigation.open")
                  }
                  className="button-secondary lg:hidden"
                  onClick={() => {
                    setIsMobileNavOpen((current) => !current);
                  }}
                  type="button"
                >
                  {isMobileNavOpen ? "Close" : "Menu"}
                </button>
                <form
                  className="flex flex-1 flex-col gap-3 sm:flex-row"
                  onSubmit={handleSearchSubmit}
                  role="search"
                >
                  <label className="sr-only" htmlFor="shell-search">
                    {t("shell.search.label")}
                  </label>
                  <input
                    className="field min-w-0 flex-1"
                    id="shell-search"
                    name="q"
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                    }}
                    placeholder={t("shell.search.placeholder")}
                    type="search"
                    value={searchQuery}
                  />
                  <button className="button-secondary" type="submit">
                    {t("shell.search.submit")}
                  </button>
                  <button
                    aria-expanded={isFilterPanelOpen}
                    className="button-secondary"
                    onClick={() => {
                      setIsFilterPanelOpen((current) => !current);
                    }}
                    type="button"
                  >
                    {isFilterPanelOpen
                      ? t("shell.search.hideFilters")
                      : t("shell.search.openFilters")}
                  </button>
                </form>
              </div>

              <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                <Link className="button-primary" to="/app/library">
                  {t("shell.upload")}
                </Link>
                <LanguageSwitcher />
                <div className="surface-card flex min-w-0 items-center gap-3 rounded-full px-3 py-2">
                  <span className="avatar-token h-11 w-11 rounded-full text-sm">
                    {getUserInitials(session?.user.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {session?.user.name ?? t("shell.unknownUser")}
                    </p>
                    <p className="truncate text-xs text-[var(--color-text-muted)]">
                      {session?.user.email ?? t("shell.noEmailConfigured")}
                    </p>
                  </div>
                </div>
                <Link className="button-secondary" to="/app/settings">
                  {t("shell.account")}
                </Link>
                <button
                  aria-label={
                    theme === "light"
                      ? t("shell.theme.switchToDark")
                      : t("shell.theme.switchToLight")
                  }
                  className="button-secondary"
                  onClick={toggleTheme}
                  type="button"
                >
                  {theme === "light"
                    ? t("shell.theme.dark")
                    : t("shell.theme.light")}
                </button>
                <button
                  className="button-secondary"
                  onClick={handleLogout}
                  type="button"
                >
                  {t("shell.logout")}
                </button>
              </div>
            </div>

            {isFilterPanelOpen ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {quickFilterLinks.map((item) => (
                  <Link
                    className="surface-card-subtle rounded-2xl p-4 transition-transform duration-150 hover:-translate-y-0.5"
                    key={item.to}
                    onClick={() => {
                      setIsFilterPanelOpen(false);
                      setIsMobileNavOpen(false);
                    }}
                    to={item.to}
                  >
                    <span className="block text-sm font-semibold">
                      {t(item.title)}
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-[var(--color-text-muted)]">
                      {t(item.description)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </header>

          <section className="panel p-5 sm:p-6">
            <div className="sr-only" aria-live="polite">
              Active locale: {locale}
            </div>
            <Outlet />
          </section>
        </main>
      </div>
    </div>
  );
}
