import type { Route } from "./+types/app-home";
import { Link } from "react-router";
import {
  Badge,
  EmptyHint,
  EmptyState,
  PageHeader,
  Panel,
  StatCard,
  SurfaceCard,
} from "~/components/ui";
import { getHealth, listPhotos, listSpaces } from "~/lib/api";
import { formatDateTime, formatRelativeCount } from "~/lib/format";
import { useSession } from "~/lib/session";
import type { HealthResponse, PhotoDto, SpaceDto } from "~/types/api";

interface DashboardState {
  health: HealthResponse | null;
  photos: PhotoDto[];
  spaces: SpaceDto[];
}

export async function clientLoader() {
  const [health, photos, spaces] = await Promise.all([
    getHealth(),
    listPhotos(0, 6),
    listSpaces(),
  ]);
  return {
    health,
    photos: photos.items,
    spaces,
  } satisfies DashboardState;
}

export default function AppHomeRoute({ loaderData }: Route.ComponentProps) {
  const session = useSession();
  const state = loaderData;

  return (
    <div className="space-y-8">
      <PageHeader
        actions={
          <>
            <Link className="button-secondary" to="/app/library">
              Open library
            </Link>
            <Link className="button-secondary" to="/app/favorites">
              Open favorites
            </Link>
            <Link className="button-primary" to="/app/spaces">
              Browse Spaces
            </Link>
          </>
        }
        description="The first implementation step focuses on the authenticated shell, profile hydration, and lightweight read-only overviews."
        eyebrow="Overview"
        title={`Welcome back, ${session?.user.name ?? "user"}`}
      />

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel className="p-6">
          <p className="eyebrow">Quick actions</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Continue where you left off
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link
              className="button-primary justify-center text-center"
              to="/app/library"
            >
              Open personal library
            </Link>
            <Link
              className="button-secondary justify-center text-center"
              to="/app/library?view=timeline"
            >
              Open timeline
            </Link>
            <Link
              className="button-secondary justify-center text-center"
              to="/app/search"
            >
              Search shell
            </Link>
            <Link
              className="button-secondary justify-center text-center"
              to="/app/spaces"
            >
              Manage Spaces
            </Link>
          </div>
        </Panel>

        <Panel className="p-6">
          <p className="eyebrow">Current phase</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Frontend hardening
          </h2>
          <p className="mt-4 text-sm leading-7 text-[var(--color-text-muted)]">
            The app shell now covers auth, library, favorites, Spaces, settings,
            timeline browsing, route-level search, and the initial admin route
            tree with capability-aware access gating.
          </p>
        </Panel>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          hint="Current photo count from the authenticated library endpoint."
          label="Photos"
          value={formatRelativeCount(state.photos.length, "item", "items")}
        />
        <StatCard
          hint="Accessible Spaces for the current user."
          label="Spaces"
          value={formatRelativeCount(state.spaces.length, "Space", "Spaces")}
        />
        <StatCard
          hint={
            state.health?.storage.type ?? "Waiting for backend health data."
          }
          label="Backend"
          value={state.health?.status === "ok" ? "Connected" : "Pending"}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel className="p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Recent photos</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Latest uploads
              </h2>
            </div>
            <Link
              className="link-accent text-sm font-semibold"
              to="/app/library"
            >
              View all
            </Link>
          </div>

          {state.photos.length === 0 ? (
            <EmptyState
              description="No photos are available yet. Upload UI comes next, but the authenticated library route structure is already in place."
              title="Library is empty"
            />
          ) : (
            <div className="mt-6 grid gap-3">
              {state.photos.map((photo) => (
                <SurfaceCard className="rounded-2xl p-4" key={photo.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight">
                        {photo.originalFilename}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                        {photo.mimeType} · {photo.width ?? "?"}x
                        {photo.height ?? "?"}
                      </p>
                    </div>
                    <Badge
                      className="rounded-full px-3 py-1 text-xs font-semibold"
                      tone="accent"
                    >
                      {photo.variants.length} variants
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                    Uploaded {formatDateTime(photo.createdAt)}
                  </p>
                  <Link
                    className="link-accent mt-4 inline-flex text-sm font-semibold"
                    to={`/app/library/photos/${photo.id}`}
                  >
                    Open photo
                  </Link>
                </SurfaceCard>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="p-6">
          <p className="eyebrow">Accessible Spaces</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Collaboration map
          </h2>

          {state.spaces.length === 0 ? (
            <EmptyHint className="mt-6 px-5 py-6 leading-7">
              No Spaces yet. Once created, the frontend already has a dedicated
              route and authenticated API boundary for them.
            </EmptyHint>
          ) : (
            <div className="mt-6 space-y-3">
              {state.spaces.map((space) => (
                <SurfaceCard className="rounded-2xl p-4" key={space.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight">
                        {space.name}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                        {space.visibility.toLowerCase()} space · depth{" "}
                        {space.depth}
                      </p>
                    </div>
                    <Badge className="rounded-full px-3 py-1 text-xs font-semibold">
                      {space.inheritMembers
                        ? "Inherited access"
                        : "Direct membership"}
                    </Badge>
                  </div>
                  {space.description ? (
                    <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
                      {space.description}
                    </p>
                  ) : null}
                  <Link
                    className="link-accent mt-4 inline-flex text-sm font-semibold"
                    to={`/app/spaces/${space.id}`}
                  >
                    Open Space
                  </Link>
                </SurfaceCard>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}
