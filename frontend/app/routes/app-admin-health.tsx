import type { Route } from "./+types/app-admin-health";
import { Link } from "react-router";
import {
  Badge,
  EmptyHint,
  InlineMessage,
  PageHeader,
  Panel,
  SurfaceCard,
} from "~/components/ui";
import { getAdminHealth, isBackendUnavailableError } from "~/lib/api";
import { toErrorMessage } from "~/lib/errors";
import { formatBytes } from "~/lib/format";
import type { AdminHealthDto } from "~/types/api";

interface AdminHealthLoaderData {
  health: AdminHealthDto | null;
  error: string | null;
}

export async function clientLoader({
  request: _request,
}: Route.ClientLoaderArgs): Promise<AdminHealthLoaderData> {
  try {
    return {
      health: await getAdminHealth(),
      error: null,
    };
  } catch (error) {
    if (isBackendUnavailableError(error)) {
      throw error;
    }

    return {
      health: null,
      error: toErrorMessage(error, "Failed to load admin health data."),
    };
  }
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "Admin Health | PINA" }];
}

export default function AppAdminHealthRoute({
  loaderData,
}: Route.ComponentProps) {
  const health = loaderData.health;
  const isDegraded =
    health != null &&
    (health.status !== "UP" ||
      !health.database.connected ||
      health.storage.availableBytes <= 0);

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Link className="button-secondary" to="/app/admin/storage">
              Open storage
            </Link>
            <Link className="button-secondary" to="/app/admin/settings">
              Open settings
            </Link>
          </>
        }
        description="Operational visibility for backend status, database connectivity, storage capacity, and JVM runtime state."
        eyebrow="Admin Health"
        title="System health"
      />

      {loaderData.error ? (
        <InlineMessage tone="danger">{loaderData.error}</InlineMessage>
      ) : null}

      {!health ? (
        <Panel className="p-6">
          <p className="eyebrow">Health</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Health data is unavailable
          </h2>
          <EmptyHint className="mt-5 px-5 py-6 leading-7">
            The admin shell remains available, but the health endpoint did not
            return operational data for this request.
          </EmptyHint>
        </Panel>
      ) : (
        <>
          <Panel className="p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="eyebrow">Runtime status</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  {isDegraded
                    ? "Degraded operational state"
                    : "System is healthy"}
                </h2>
                <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
                  Backend status: {health.status}. Database connectivity,
                  storage capacity, and JVM runtime are summarized below for
                  instance operators.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  tone={isDegraded ? "neutral" : "accent"}
                >
                  {isDegraded ? "degraded" : "healthy"}
                </Badge>
                <Badge className="rounded-full px-3 py-1 text-xs font-semibold">
                  version {health.version}
                </Badge>
              </div>
            </div>

            {isDegraded ? (
              <EmptyHint className="mt-5 px-5 py-5 leading-7">
                One or more operational checks are degraded. Review database
                connectivity and remaining storage capacity before treating the
                instance as healthy.
              </EmptyHint>
            ) : null}

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SurfaceCard className="rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                  Backend
                </p>
                <p className="mt-3 text-lg font-semibold tracking-tight">
                  {health.status}
                </p>
              </SurfaceCard>
              <SurfaceCard className="rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                  Database
                </p>
                <p className="mt-3 text-lg font-semibold tracking-tight">
                  {health.database.connected ? "Connected" : "Unavailable"}
                </p>
              </SurfaceCard>
              <SurfaceCard className="rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                  Storage provider
                </p>
                <p className="mt-3 text-lg font-semibold tracking-tight">
                  {health.storage.provider}
                </p>
              </SurfaceCard>
              <SurfaceCard className="rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                  CPUs
                </p>
                <p className="mt-3 text-lg font-semibold tracking-tight">
                  {health.jvm.availableProcessors}
                </p>
              </SurfaceCard>
            </div>
          </Panel>

          <section className="grid gap-6 xl:grid-cols-3">
            <Panel className="p-6">
              <p className="eyebrow">Database</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Connectivity
              </h2>
              <dl className="mt-5 space-y-3 text-sm text-[var(--color-text-muted)]">
                <div className="flex justify-between gap-4">
                  <dt>Connected</dt>
                  <dd>{health.database.connected ? "Yes" : "No"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Version</dt>
                  <dd className="max-w-[14rem] truncate text-right">
                    {health.database.version ?? "Not available"}
                  </dd>
                </div>
              </dl>
            </Panel>

            <Panel className="p-6">
              <p className="eyebrow">Storage</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Capacity
              </h2>
              <dl className="mt-5 space-y-3 text-sm text-[var(--color-text-muted)]">
                <div className="flex justify-between gap-4">
                  <dt>Used</dt>
                  <dd>{formatBytes(health.storage.usedBytes)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Available</dt>
                  <dd>{formatBytes(health.storage.availableBytes)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Provider</dt>
                  <dd>{health.storage.provider}</dd>
                </div>
              </dl>
            </Panel>

            <Panel className="p-6">
              <p className="eyebrow">JVM</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Runtime memory
              </h2>
              <dl className="mt-5 space-y-3 text-sm text-[var(--color-text-muted)]">
                <div className="flex justify-between gap-4">
                  <dt>Heap used</dt>
                  <dd>{formatBytes(health.jvm.heapUsedBytes)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Heap max</dt>
                  <dd>{formatBytes(health.jvm.heapMaxBytes)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Non-heap used</dt>
                  <dd>{formatBytes(health.jvm.nonHeapUsedBytes)}</dd>
                </div>
              </dl>
            </Panel>
          </section>
        </>
      )}
    </div>
  );
}
