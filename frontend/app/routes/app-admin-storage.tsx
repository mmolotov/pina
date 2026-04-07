import type { Route } from "./+types/app-admin-storage";
import { Link, useSearchParams } from "react-router";
import {
  EmptyHint,
  InlineMessage,
  PageHeader,
  Panel,
  SurfaceCard,
} from "~/components/ui";
import {
  getAdminStorageSummary,
  isBackendUnavailableError,
  listAdminStorageSpaces,
  listAdminStorageUsers,
} from "~/lib/api";
import { toErrorMessage } from "~/lib/errors";
import { formatBytes, formatRelativeCount } from "~/lib/format";
import type {
  AdminSpaceStorageDto,
  AdminStorageSummaryDto,
  AdminUserStorageDto,
  PageResponse,
} from "~/types/api";

interface AdminStorageLoaderData {
  summary: AdminStorageSummaryDto | null;
  summaryError: string | null;
  usersPage: PageResponse<AdminUserStorageDto>;
  usersError: string | null;
  spacesPage: PageResponse<AdminSpaceStorageDto>;
  spacesError: string | null;
}

const EMPTY_USER_PAGE: PageResponse<AdminUserStorageDto> = {
  items: [],
  page: 0,
  size: 10,
  hasNext: false,
  totalItems: 0,
  totalPages: 0,
};

const EMPTY_SPACE_PAGE: PageResponse<AdminSpaceStorageDto> = {
  items: [],
  page: 0,
  size: 10,
  hasNext: false,
  totalItems: 0,
  totalPages: 0,
};

export async function clientLoader({
  request,
}: Route.ClientLoaderArgs): Promise<AdminStorageLoaderData> {
  const url = new URL(request.url);
  const userPageParam = Number(url.searchParams.get("userPage") ?? "0");
  const spacePageParam = Number(url.searchParams.get("spacePage") ?? "0");
  const userPage =
    Number.isFinite(userPageParam) && userPageParam >= 0 ? userPageParam : 0;
  const spacePage =
    Number.isFinite(spacePageParam) && spacePageParam >= 0 ? spacePageParam : 0;

  let summary: AdminStorageSummaryDto | null = null;
  let summaryError: string | null = null;
  let usersPage = EMPTY_USER_PAGE;
  let usersError: string | null = null;
  let spacesPage = EMPTY_SPACE_PAGE;
  let spacesError: string | null = null;

  try {
    summary = await getAdminStorageSummary();
  } catch (error) {
    if (isBackendUnavailableError(error)) {
      throw error;
    }

    summaryError = toErrorMessage(error, "Failed to load storage summary.");
  }

  try {
    usersPage = await listAdminStorageUsers({
      page: userPage,
      size: 10,
      needsTotal: true,
    });
  } catch (error) {
    if (isBackendUnavailableError(error)) {
      throw error;
    }

    usersError = toErrorMessage(
      error,
      "Failed to load user storage breakdown.",
    );
  }

  try {
    spacesPage = await listAdminStorageSpaces({
      page: spacePage,
      size: 10,
      needsTotal: true,
    });
  } catch (error) {
    if (isBackendUnavailableError(error)) {
      throw error;
    }

    spacesError = toErrorMessage(
      error,
      "Failed to load Space storage breakdown.",
    );
  }

  return {
    summary,
    summaryError,
    usersPage,
    usersError,
    spacesPage,
    spacesError,
  };
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "Admin Storage | PINA" }];
}

export default function AppAdminStorageRoute({
  loaderData,
}: Route.ComponentProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const summary = loaderData.summary;
  const isEmptyStorage =
    summary != null &&
    summary.totalPhotos === 0 &&
    loaderData.usersPage.items.length === 0 &&
    loaderData.spacesPage.items.length === 0;

  function updatePage(key: "userPage" | "spacePage", page: number) {
    const nextParams = new URLSearchParams(searchParams);
    if (page <= 0) {
      nextParams.delete(key);
    } else {
      nextParams.set(key, String(page));
    }
    setSearchParams(nextParams, { replace: true });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Link className="button-secondary" to="/app/admin/health">
              Open health
            </Link>
            <Link className="button-secondary" to="/app/admin/settings">
              Open settings
            </Link>
          </>
        }
        description="Operational overview of stored media volume, filesystem capacity, and owner-level storage distribution across users and Spaces."
        eyebrow="Admin Storage"
        title="Storage operations"
      />

      {loaderData.summaryError ? (
        <InlineMessage tone="danger">{loaderData.summaryError}</InlineMessage>
      ) : null}

      {summary ? (
        isEmptyStorage ? (
          <Panel className="p-6">
            <p className="eyebrow">Storage summary</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              No stored media yet
            </h2>
            <EmptyHint className="mt-5 px-5 py-6 leading-7">
              The instance has not accumulated uploaded photos or derived
              variants yet. Storage breakdowns remain available and should stay
              empty until new uploads arrive.
            </EmptyHint>
          </Panel>
        ) : (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <SurfaceCard className="rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                Provider
              </p>
              <p className="mt-3 text-lg font-semibold tracking-tight">
                {summary.storageProvider}
              </p>
            </SurfaceCard>
            <SurfaceCard className="rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                Photos
              </p>
              <p className="mt-3 text-lg font-semibold tracking-tight">
                {summary.totalPhotos}
              </p>
            </SurfaceCard>
            <SurfaceCard className="rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                Variants
              </p>
              <p className="mt-3 text-lg font-semibold tracking-tight">
                {summary.totalVariants}
              </p>
            </SurfaceCard>
            <SurfaceCard className="rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                Media bytes
              </p>
              <p className="mt-3 text-lg font-semibold tracking-tight">
                {formatBytes(summary.totalStorageBytes)}
              </p>
            </SurfaceCard>
            <SurfaceCard className="rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                FS available
              </p>
              <p className="mt-3 text-lg font-semibold tracking-tight">
                {formatBytes(summary.filesystemAvailableBytes)}
              </p>
            </SurfaceCard>
          </section>
        )
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Users</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Per-user storage
              </h2>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                {(loaderData.usersPage.totalItems ??
                  loaderData.usersPage.items.length) ||
                  0}{" "}
                matching users · page {loaderData.usersPage.page + 1}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="button-secondary"
                disabled={loaderData.usersPage.page === 0}
                onClick={() =>
                  updatePage("userPage", loaderData.usersPage.page - 1)
                }
                type="button"
              >
                Previous
              </button>
              <button
                className="button-secondary"
                disabled={!loaderData.usersPage.hasNext}
                onClick={() =>
                  updatePage("userPage", loaderData.usersPage.page + 1)
                }
                type="button"
              >
                Next
              </button>
            </div>
          </div>

          {loaderData.usersError ? (
            <InlineMessage className="mt-6" tone="danger">
              {loaderData.usersError}
            </InlineMessage>
          ) : loaderData.usersPage.items.length === 0 ? (
            <EmptyHint className="mt-6 px-5 py-6 leading-7">
              No user storage rows are available for the current page.
            </EmptyHint>
          ) : (
            <div className="mt-6 space-y-3">
              {loaderData.usersPage.items.map((row) => (
                <SurfaceCard className="rounded-2xl p-4" key={row.userId}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold tracking-tight">
                        {row.userName}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                        {formatRelativeCount(row.photoCount, "photo", "photos")}{" "}
                        ·{" "}
                        {formatRelativeCount(
                          row.variantCount,
                          "variant",
                          "variants",
                        )}
                      </p>
                    </div>
                    <p className="text-sm font-semibold">
                      {formatBytes(row.storageBytesUsed)}
                    </p>
                  </div>
                </SurfaceCard>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Spaces</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Per-Space media activity
              </h2>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                {(loaderData.spacesPage.totalItems ??
                  loaderData.spacesPage.items.length) ||
                  0}{" "}
                matching Spaces · page {loaderData.spacesPage.page + 1}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="button-secondary"
                disabled={loaderData.spacesPage.page === 0}
                onClick={() =>
                  updatePage("spacePage", loaderData.spacesPage.page - 1)
                }
                type="button"
              >
                Previous
              </button>
              <button
                className="button-secondary"
                disabled={!loaderData.spacesPage.hasNext}
                onClick={() =>
                  updatePage("spacePage", loaderData.spacesPage.page + 1)
                }
                type="button"
              >
                Next
              </button>
            </div>
          </div>

          {loaderData.spacesError ? (
            <InlineMessage className="mt-6" tone="danger">
              {loaderData.spacesError}
            </InlineMessage>
          ) : loaderData.spacesPage.items.length === 0 ? (
            <EmptyHint className="mt-6 px-5 py-6 leading-7">
              No Space storage rows are available for the current page.
            </EmptyHint>
          ) : (
            <div className="mt-6 space-y-3">
              {loaderData.spacesPage.items.map((row) => (
                <SurfaceCard className="rounded-2xl p-4" key={row.spaceId}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold tracking-tight">
                        {row.spaceName}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                        {formatRelativeCount(row.albumCount, "album", "albums")}{" "}
                        ·{" "}
                        {formatRelativeCount(row.photoCount, "photo", "photos")}
                      </p>
                    </div>
                    <Link
                      className="button-secondary"
                      to={`/app/admin/spaces?space=${row.spaceId}`}
                    >
                      Inspect
                    </Link>
                  </div>
                </SurfaceCard>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}
