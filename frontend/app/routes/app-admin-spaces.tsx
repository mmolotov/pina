import type { Route } from "./+types/app-admin-spaces";
import { useEffect, useMemo, useState } from "react";
import {
  Form,
  Link,
  useActionData,
  useNavigation,
  useRevalidator,
  useSearchParams,
} from "react-router";
import {
  Badge,
  EmptyHint,
  InlineMessage,
  PageHeader,
  Panel,
  SurfaceCard,
} from "~/components/ui";
import {
  deleteAdminSpace,
  getAdminSpace,
  isBackendUnavailableError,
  listAdminSpaces,
} from "~/lib/api";
import { toErrorMessage } from "~/lib/errors";
import { formatDateTime, formatRelativeCount } from "~/lib/format";
import { toActionErrorMessage } from "~/lib/route-actions";
import type { AdminSpaceDto, PageResponse } from "~/types/api";

interface AdminSpacesLoaderData {
  page: PageResponse<AdminSpaceDto>;
  selectedSpace: AdminSpaceDto | null;
  selectedSpaceError: string | null;
  listError: string | null;
  search: string;
  selectedSpaceId: string | null;
}

const EMPTY_PAGE: PageResponse<AdminSpaceDto> = {
  items: [],
  page: 0,
  size: 20,
  hasNext: false,
  totalItems: 0,
  totalPages: 0,
};

type DeleteAdminSpaceActionResult =
  | { ok: true; successMessage: string; spaceId: string }
  | { ok: false; errorMessage: string; spaceId: string | null };

export async function clientLoader({
  request,
}: Route.ClientLoaderArgs): Promise<AdminSpacesLoaderData> {
  const url = new URL(request.url);
  const pageParam = Number(url.searchParams.get("page") ?? "0");
  const page = Number.isFinite(pageParam) && pageParam >= 0 ? pageParam : 0;
  const search = url.searchParams.get("search")?.trim() ?? "";
  const selectedSpaceId = url.searchParams.get("space");

  let listError: string | null = null;
  let selectedSpaceError: string | null = null;
  let spacesPage = EMPTY_PAGE;
  let selectedSpace: AdminSpaceDto | null = null;

  try {
    spacesPage = await listAdminSpaces({
      page,
      size: 20,
      needsTotal: true,
      search,
    });
  } catch (error) {
    if (isBackendUnavailableError(error)) {
      throw error;
    }

    listError = toErrorMessage(error, "Failed to load admin Spaces.");
  }

  if (selectedSpaceId && !listError) {
    try {
      selectedSpace = await getAdminSpace(selectedSpaceId);
    } catch (error) {
      if (isBackendUnavailableError(error)) {
        throw error;
      }

      selectedSpaceError = toErrorMessage(
        error,
        "Failed to load Space details.",
      );
    }
  }

  return {
    page: spacesPage,
    selectedSpace,
    selectedSpaceError,
    listError,
    search,
    selectedSpaceId,
  };
}

export async function clientAction({
  request,
}: Route.ClientActionArgs): Promise<DeleteAdminSpaceActionResult> {
  const formData = await request.formData();
  const spaceId = String(formData.get("spaceId") ?? "").trim() || null;

  if (!spaceId) {
    return {
      ok: false,
      errorMessage: "Space id is required.",
      spaceId: null,
    };
  }

  try {
    await deleteAdminSpace(spaceId);
    return {
      ok: true,
      successMessage: "Space deleted.",
      spaceId,
    };
  } catch (error) {
    return {
      ok: false,
      errorMessage: toActionErrorMessage(error, "Failed to delete Space."),
      spaceId,
    };
  }
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "Admin Spaces | PINA" }];
}

export default function AppAdminSpacesRoute({
  loaderData,
}: Route.ComponentProps) {
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(loaderData.search);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const currentPage = loaderData.page.page;
  const hasPreviousPage = currentPage > 0;
  const totalItems = loaderData.page.totalItems ?? loaderData.page.items.length;
  const selectedSpace = loaderData.selectedSpace;
  const isDeleting = navigation.state !== "idle";

  useEffect(() => {
    setSearchDraft(loaderData.search);
  }, [loaderData.search]);

  useEffect(() => {
    if (!actionData) {
      return;
    }

    if (actionData.ok) {
      setSuccessMessage(actionData.successMessage);

      if (actionData.spaceId === loaderData.selectedSpaceId) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("space");
        setSearchParams(nextParams, { replace: true });
        return;
      }

      revalidator.revalidate();
      return;
    }

    setSuccessMessage(null);
  }, [
    actionData,
    loaderData.selectedSpaceId,
    revalidator,
    searchParams,
    setSearchParams,
  ]);

  const errorMessage =
    actionData && !actionData.ok ? actionData.errorMessage : null;
  const selectedSpaceStats = useMemo(
    () =>
      selectedSpace
        ? [
            {
              label: "Members",
              value: formatRelativeCount(
                selectedSpace.memberCount,
                "member",
                "members",
              ),
            },
            {
              label: "Albums",
              value: formatRelativeCount(
                selectedSpace.albumCount,
                "album",
                "albums",
              ),
            },
            {
              label: "Photos",
              value: formatRelativeCount(
                selectedSpace.photoCount,
                "photo",
                "photos",
              ),
            },
          ]
        : [],
    [selectedSpace],
  );

  function updateParams(
    updates: Record<string, string | null>,
    options: { resetPage?: boolean } = {},
  ) {
    const nextParams = new URLSearchParams(searchParams);

    if (options.resetPage) {
      nextParams.delete("page");
    }

    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value.length === 0) {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
    }

    setSuccessMessage(null);
    setSearchParams(nextParams, { replace: true });
  }

  function goToPage(page: number) {
    updateParams({ page: String(page) });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Link className="button-secondary" to="/app/admin/invites">
              Open admin invites
            </Link>
            <Link className="button-secondary" to="/app/spaces">
              Open member Spaces
            </Link>
          </>
        }
        description="Browse Spaces across the whole instance, inspect ownership and content counts, and apply the supported global delete action separately from normal membership flows."
        eyebrow="Admin Spaces"
        title="Space oversight"
      />

      <Panel className="p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="eyebrow">Global browse</p>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Search Spaces by name and keep the selected Space in the current
              route state for dedicated admin review.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
            <input
              aria-label="Search Spaces"
              className="field min-w-0 md:min-w-80"
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search by Space name"
              type="search"
              value={searchDraft}
            />
            <button
              className="button-secondary"
              onClick={() =>
                updateParams(
                  {
                    search: searchDraft.trim() || null,
                    space: null,
                  },
                  { resetPage: true },
                )
              }
              type="button"
            >
              Apply
            </button>
            <button
              className="button-secondary"
              disabled={
                loaderData.search.length === 0 && searchDraft.length === 0
              }
              onClick={() => {
                setSearchDraft("");
                updateParams(
                  { search: null, space: null },
                  { resetPage: true },
                );
              }}
              type="button"
            >
              Clear
            </button>
          </div>
        </div>
      </Panel>

      {errorMessage ? (
        <InlineMessage tone="danger">{errorMessage}</InlineMessage>
      ) : null}
      {successMessage ? (
        <InlineMessage tone="success">{successMessage}</InlineMessage>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_0.95fr]">
        <Panel className="p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Spaces</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Instance-wide Space inventory
              </h2>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                {totalItems} total matching{" "}
                {totalItems === 1 ? "Space" : "Spaces"} · page {currentPage + 1}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="button-secondary"
                disabled={isDeleting || !hasPreviousPage}
                onClick={() => goToPage(currentPage - 1)}
                type="button"
              >
                Previous
              </button>
              <button
                className="button-secondary"
                disabled={isDeleting || !loaderData.page.hasNext}
                onClick={() => goToPage(currentPage + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          </div>

          {loaderData.listError ? (
            <InlineMessage className="mt-6" tone="danger">
              {loaderData.listError}
            </InlineMessage>
          ) : loaderData.page.items.length === 0 ? (
            <EmptyHint className="mt-6 px-5 py-6 leading-7">
              No Spaces match the current admin filters.
            </EmptyHint>
          ) : (
            <div className="mt-6 space-y-3">
              {loaderData.page.items.map((space) => {
                const isSelected = loaderData.selectedSpaceId === space.id;

                return (
                  <Link
                    className={[
                      "surface-card block rounded-2xl p-4 transition-transform duration-150 hover:-translate-y-0.5",
                      isSelected ? "border border-[var(--color-accent)]" : "",
                    ].join(" ")}
                    key={space.id}
                    to={`/app/admin/spaces?${new URLSearchParams({
                      ...(loaderData.search
                        ? { search: loaderData.search }
                        : {}),
                      ...(currentPage > 0 ? { page: String(currentPage) } : {}),
                      space: space.id,
                    }).toString()}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold tracking-tight">
                          {space.name}
                        </h3>
                        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                          Created by {space.creatorName}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Badge
                          className="rounded-full px-3 py-1 text-xs font-semibold"
                          tone={
                            space.visibility === "PUBLIC" ? "accent" : "neutral"
                          }
                        >
                          {space.visibility.toLowerCase()}
                        </Badge>
                        <Badge className="rounded-full px-3 py-1 text-xs font-semibold">
                          depth {space.depth}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-[var(--color-text-muted)] sm:grid-cols-3">
                      <span>
                        {formatRelativeCount(
                          space.memberCount,
                          "member",
                          "members",
                        )}
                      </span>
                      <span>
                        {formatRelativeCount(
                          space.albumCount,
                          "album",
                          "albums",
                        )}
                      </span>
                      <span>
                        {formatRelativeCount(
                          space.photoCount,
                          "photo",
                          "photos",
                        )}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel className="p-6">
            {!selectedSpace && loaderData.selectedSpaceError ? (
              <>
                <p className="eyebrow">Space detail</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  Failed to load selected Space
                </h2>
                <InlineMessage className="mt-5" tone="danger">
                  {loaderData.selectedSpaceError}
                </InlineMessage>
              </>
            ) : !selectedSpace ? (
              <>
                <p className="eyebrow">Space detail</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  Select a Space
                </h2>
                <EmptyHint className="mt-5 px-5 py-6 leading-7">
                  Pick a Space from the inventory to inspect ownership,
                  hierarchy, and content metrics before applying global admin
                  actions.
                </EmptyHint>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="eyebrow">Space detail</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                      {selectedSpace.name}
                    </h2>
                    <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                      {selectedSpace.description?.trim() ||
                        "No description provided."}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge
                      className="rounded-full px-3 py-1 text-xs font-semibold"
                      tone={
                        selectedSpace.visibility === "PUBLIC"
                          ? "accent"
                          : "neutral"
                      }
                    >
                      {selectedSpace.visibility.toLowerCase()}
                    </Badge>
                    <Badge className="rounded-full px-3 py-1 text-xs font-semibold">
                      depth {selectedSpace.depth}
                    </Badge>
                  </div>
                </div>

                <dl className="mt-6 space-y-3 text-sm text-[var(--color-text-muted)]">
                  <div className="flex justify-between gap-4">
                    <dt>Space id</dt>
                    <dd className="max-w-[14rem] truncate text-right">
                      {selectedSpace.id}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Creator</dt>
                    <dd>{selectedSpace.creatorName}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Parent Space</dt>
                    <dd>{selectedSpace.parentId ?? "Root Space"}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Created</dt>
                    <dd>{formatDateTime(selectedSpace.createdAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Updated</dt>
                    <dd>{formatDateTime(selectedSpace.updatedAt)}</dd>
                  </div>
                </dl>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {selectedSpaceStats.map((stat) => (
                    <SurfaceCard className="rounded-2xl p-4" key={stat.label}>
                      <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                        {stat.label}
                      </p>
                      <p className="mt-3 text-lg font-semibold tracking-tight">
                        {stat.value}
                      </p>
                    </SurfaceCard>
                  ))}
                </div>
              </>
            )}
          </Panel>

          {selectedSpace ? (
            <Panel className="p-6">
              <p className="eyebrow">Global admin action</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Force-delete Space
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
                This permanently removes the selected Space through the global
                admin API. It is intentionally separate from ordinary Space
                membership or content-management flows.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  className="button-secondary"
                  to={`/app/admin/invites?${new URLSearchParams({
                    spaceId: selectedSpace.id,
                    active: "true",
                  }).toString()}`}
                >
                  Open invites for this Space
                </Link>
                <Link
                  className="button-secondary"
                  to={`/app/spaces/${selectedSpace.id}`}
                >
                  Open member-facing Space
                </Link>
              </div>

              <EmptyHint className="mt-5 px-5 py-5 leading-7">
                Force-delete is irreversible and should be used only for
                instance-level moderation, test cleanup, or policy enforcement.
              </EmptyHint>

              <Form className="mt-5" method="post">
                <input name="spaceId" type="hidden" value={selectedSpace.id} />
                <button
                  className="button-primary"
                  disabled={isDeleting}
                  type="submit"
                >
                  {isDeleting ? "Deleting Space..." : "Delete Space"}
                </button>
              </Form>
            </Panel>
          ) : null}
        </div>
      </section>
    </div>
  );
}
