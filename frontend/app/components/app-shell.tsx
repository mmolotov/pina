import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { logout } from "~/lib/api";
import { useSession } from "~/lib/session";
import { useTheme } from "~/lib/theme";

const navItems = [
  { to: "/app", label: "Overview" },
  { to: "/app/library", label: "Library" },
  { to: "/app/search", label: "Search" },
  { to: "/app/favorites", label: "Favorites" },
  { to: "/app/spaces", label: "Spaces" },
  { to: "/app/settings", label: "Settings" },
];

export function AppShell() {
  const navigate = useNavigate();
  const session = useSession();
  const { theme, toggleTheme } = useTheme();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="app-shell min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto mb-4 flex max-w-7xl items-center justify-between gap-3 lg:hidden">
        <div>
          <p className="eyebrow">Phase 3 Frontend</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">PINA</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            className="button-secondary"
            onClick={toggleTheme}
            type="button"
          >
            {theme === "light" ? "Dark theme" : "Light theme"}
          </button>
          <button
            aria-expanded={isMobileNavOpen}
            aria-label={
              isMobileNavOpen ? "Close navigation" : "Open navigation"
            }
            className="button-secondary"
            onClick={() => {
              setIsMobileNavOpen((current) => !current);
            }}
            type="button"
          >
            {isMobileNavOpen ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl flex-col gap-4 lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside
          className={[
            "panel flex flex-col gap-8 p-6",
            isMobileNavOpen ? "block" : "hidden lg:flex",
          ].join(" ")}
        >
          <div>
            <p className="eyebrow">Phase 3 Frontend</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">PINA</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
              Personal media, albums, and Space collaboration on top of the
              Phase 2 backend.
            </p>
          </div>

          <nav className="flex flex-col gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                className={({ isActive }) =>
                  [
                    "nav-link",
                    isActive ? "nav-link-active" : "nav-link-idle",
                  ].join(" ")
                }
                end={item.to === "/app"}
                to={item.to}
                onClick={() => {
                  setIsMobileNavOpen(false);
                }}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="surface-card rounded-3xl p-4">
            <p className="eyebrow">Signed in as</p>
            <p className="mt-2 text-lg font-semibold tracking-tight">
              {session?.user.name ?? "Unknown user"}
            </p>
            <p className="mt-1 break-all text-sm text-[var(--color-text-muted)]">
              {session?.user.email ?? "No email configured"}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <span className="badge-neutral rounded-full px-3 py-1 text-xs font-semibold">
                {theme === "light" ? "Light theme" : "Dark theme"}
              </span>
              <button
                aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
                className="link-accent text-sm font-semibold"
                onClick={toggleTheme}
                type="button"
              >
                Switch theme
              </button>
            </div>
            <NavLink
              className="link-accent mt-4 inline-flex text-sm font-semibold"
              onClick={() => {
                setIsMobileNavOpen(false);
              }}
              to="/app/settings"
            >
              Manage profile
            </NavLink>
          </div>

          <button
            className="button-secondary w-full"
            onClick={handleLogout}
            type="button"
          >
            Log out
          </button>
        </aside>

        <main className="panel p-6 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
