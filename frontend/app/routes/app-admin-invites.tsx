import type { Route } from "./+types/app-admin-invites";
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
  isBackendUnavailableError,
  listAdminInvites,
  revokeAdminInvite,
} from "~/lib/api";
import { toErrorMessage } from "~/lib/errors";
import { formatDateTime, formatRelativeCount } from "~/lib/format";
import { toActionErrorMessage } from "~/lib/route-actions";
import type { AdminInviteLinkDto, PageResponse } from "~/types/api";

interface AdminInvitesLoaderData {
  page: PageResponse<AdminInviteLinkDto>;
  selectedInvite: AdminInviteLinkDto | null;
  selectedInviteError: string | null;
  listError: string | null;
  activeFilter: "all" | "true" | "false";
  selectedInviteId: string | null;
  spaceIdFilter: string;
}

const EMPTY_PAGE: PageResponse<AdminInviteLinkDto> = {
  items: [],
  page: 0,
  size: 20,
  hasNext: false,
  totalItems: 0,
  totalPages: 0,
};

type RevokeAdminInviteActionResult =
  | { ok: true; successMessage: string; inviteId: string }
  | { ok: false; errorMessage: string; inviteId: string | null };

function parseActiveFilter(value: string | null) {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return null;
}

export async function clientLoader({
  request,
}: Route.ClientLoaderArgs): Promise<AdminInvitesLoaderData> {
  const url = new URL(request.url);
  const pageParam = Number(url.searchParams.get("page") ?? "0");
  const page = Number.isFinite(pageParam) && pageParam >= 0 ? pageParam : 0;
  const activeFilter = url.searchParams.get("active");
  const spaceIdFilter = url.searchParams.get("spaceId")?.trim() ?? "";
  const selectedInviteId = url.searchParams.get("invite");

  let invitesPage = EMPTY_PAGE;
  let listError: string | null = null;

  try {
    invitesPage = await listAdminInvites({
      page,
      size: 20,
      needsTotal: true,
      active: parseActiveFilter(activeFilter),
      spaceId: spaceIdFilter || null,
    });
  } catch (error) {
    if (isBackendUnavailableError(error)) {
      throw error;
    }

    listError = toErrorMessage(error, "Failed to load admin invites.");
  }

  const selectedInvite =
    selectedInviteId && !listError
      ? (invitesPage.items.find((invite) => invite.id === selectedInviteId) ??
        null)
      : null;
  const selectedInviteError =
    selectedInviteId && !listError && !selectedInvite
      ? "The selected invite is not available in the current filtered result set."
      : null;

  return {
    page: invitesPage,
    selectedInvite,
    selectedInviteError,
    listError,
    activeFilter:
      activeFilter === "true" || activeFilter === "false"
        ? activeFilter
        : "all",
    selectedInviteId,
    spaceIdFilter,
  };
}

export async function clientAction({
  request,
}: Route.ClientActionArgs): Promise<RevokeAdminInviteActionResult> {
  const formData = await request.formData();
  const inviteId = String(formData.get("inviteId") ?? "").trim() || null;

  if (!inviteId) {
    return {
      ok: false,
      errorMessage: "Invite id is required.",
      inviteId: null,
    };
  }

  try {
    await revokeAdminInvite(inviteId);
    return {
      ok: true,
      successMessage: "Invite revoked.",
      inviteId,
    };
  } catch (error) {
    return {
      ok: false,
      errorMessage: toActionErrorMessage(error, "Failed to revoke invite."),
      inviteId,
    };
  }
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "Admin Invites | PINA" }];
}

export default function AppAdminInvitesRoute({
  loaderData,
}: Route.ComponentProps) {
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeDraft, setActiveDraft] = useState(loaderData.activeFilter);
  const [spaceIdDraft, setSpaceIdDraft] = useState(loaderData.spaceIdFilter);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const currentPage = loaderData.page.page;
  const hasPreviousPage = currentPage > 0;
  const totalItems = loaderData.page.totalItems ?? loaderData.page.items.length;
  const selectedInvite = loaderData.selectedInvite;
  const isSubmitting = navigation.state !== "idle";

  useEffect(() => {
    setActiveDraft(loaderData.activeFilter);
    setSpaceIdDraft(loaderData.spaceIdFilter);
  }, [loaderData.activeFilter, loaderData.spaceIdFilter]);

  useEffect(() => {
    if (!actionData) {
      return;
    }

    if (actionData.ok) {
      setSuccessMessage(actionData.successMessage);

      if (actionData.inviteId === loaderData.selectedInviteId) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("invite");
        setSearchParams(nextParams, { replace: true });
        return;
      }

      revalidator.revalidate();
      return;
    }

    setSuccessMessage(null);
  }, [
    actionData,
    loaderData.selectedInviteId,
    revalidator,
    searchParams,
    setSearchParams,
  ]);

  const errorMessage =
    actionData && !actionData.ok ? actionData.errorMessage : null;
  const selectedInviteStats = useMemo(
    () =>
      selectedInvite
        ? [
            {
              label: "Usage",
              value:
                selectedInvite.usageLimit == null
                  ? `${selectedInvite.usageCount} used · unlimited`
                  : `${selectedInvite.usageCount} / ${selectedInvite.usageLimit}`,
            },
            {
              label: "Role",
              value: selectedInvite.defaultRole,
            },
            {
              label: "State",
              value: selectedInvite.active ? "Active" : "Inactive",
            },
          ]
        : [],
    [selectedInvite],
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
            <Link className="button-secondary" to="/app/admin/spaces">
              Open admin Spaces
            </Link>
            <Link className="button-secondary" to="/app/spaces">
              Open member Spaces
            </Link>
          </>
        }
        description="Inspect invite inventory across the instance and revoke links through the dedicated admin surface instead of mixing these controls into everyday Space collaboration flows."
        eyebrow="Admin Invites"
        title="Invite oversight"
      />

      <Panel className="p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="eyebrow">Global filters</p>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Filter invite inventory by state or scope it to a specific Space
              id when investigating a moderation or access incident.
            </p>
          </div>
          <div className="grid w-full gap-3 md:w-auto md:grid-cols-[12rem_18rem_auto_auto]">
            <select
              aria-label="Invite status"
              className="field"
              onChange={(event) =>
                setActiveDraft(event.target.value as "all" | "true" | "false")
              }
              value={activeDraft}
            >
              <option value="all">All invites</option>
              <option value="true">Active only</option>
              <option value="false">Inactive only</option>
            </select>
            <input
              aria-label="Space id filter"
              className="field min-w-0"
              onChange={(event) => setSpaceIdDraft(event.target.value)}
              placeholder="Optional Space id"
              type="text"
              value={spaceIdDraft}
            />
            <button
              className="button-secondary"
              onClick={() =>
                updateParams(
                  {
                    active: activeDraft === "all" ? null : activeDraft,
                    spaceId: spaceIdDraft.trim() || null,
                    invite: null,
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
                loaderData.activeFilter === "all" &&
                loaderData.spaceIdFilter.length === 0 &&
                activeDraft === "all" &&
                spaceIdDraft.length === 0
              }
              onClick={() => {
                setActiveDraft("all");
                setSpaceIdDraft("");
                updateParams(
                  { active: null, spaceId: null, invite: null },
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
              <p className="eyebrow">Invites</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Instance invite inventory
              </h2>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                {totalItems} total matching{" "}
                {totalItems === 1 ? "invite" : "invites"} · page{" "}
                {currentPage + 1}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="button-secondary"
                disabled={isSubmitting || !hasPreviousPage}
                onClick={() => goToPage(currentPage - 1)}
                type="button"
              >
                Previous
              </button>
              <button
                className="button-secondary"
                disabled={isSubmitting || !loaderData.page.hasNext}
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
              No invites match the current admin filters.
            </EmptyHint>
          ) : (
            <div className="mt-6 space-y-3">
              {loaderData.page.items.map((invite) => {
                const isSelected = loaderData.selectedInviteId === invite.id;

                return (
                  <Link
                    className={[
                      "surface-card block rounded-2xl p-4 transition-transform duration-150 hover:-translate-y-0.5",
                      isSelected ? "border border-[var(--color-accent)]" : "",
                    ].join(" ")}
                    key={invite.id}
                    to={`/app/admin/invites?${new URLSearchParams({
                      ...(loaderData.activeFilter !== "all"
                        ? { active: loaderData.activeFilter }
                        : {}),
                      ...(loaderData.spaceIdFilter
                        ? { spaceId: loaderData.spaceIdFilter }
                        : {}),
                      ...(currentPage > 0 ? { page: String(currentPage) } : {}),
                      invite: invite.id,
                    }).toString()}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold tracking-tight">
                          {invite.spaceName}
                        </h3>
                        <p className="mt-1 truncate font-mono text-xs text-[var(--color-text-muted)]">
                          {invite.code}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Badge
                          className="rounded-full px-3 py-1 text-xs font-semibold"
                          tone={invite.active ? "accent" : "neutral"}
                        >
                          {invite.active ? "active" : "inactive"}
                        </Badge>
                        <Badge className="rounded-full px-3 py-1 text-xs font-semibold">
                          {invite.defaultRole.toLowerCase()}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-[var(--color-text-muted)] sm:grid-cols-3">
                      <span>
                        {formatRelativeCount(invite.usageCount, "use", "uses")}
                      </span>
                      <span>
                        {invite.usageLimit == null
                          ? "Unlimited"
                          : `Limit ${invite.usageLimit}`}
                      </span>
                      <span>{formatDateTime(invite.createdAt)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel className="p-6">
            {!selectedInvite && loaderData.selectedInviteError ? (
              <>
                <p className="eyebrow">Invite detail</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  Invite is not available for this filter
                </h2>
                <InlineMessage className="mt-5" tone="danger">
                  {loaderData.selectedInviteError}
                </InlineMessage>
              </>
            ) : !selectedInvite ? (
              <>
                <p className="eyebrow">Invite detail</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  Select an invite
                </h2>
                <EmptyHint className="mt-5 px-5 py-6 leading-7">
                  Pick an invite from the instance inventory to inspect its
                  scope, usage, and current active state before revoking it.
                </EmptyHint>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="eyebrow">Invite detail</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                      {selectedInvite.spaceName}
                    </h2>
                    <p className="mt-2 break-all font-mono text-sm text-[var(--color-text-muted)]">
                      {selectedInvite.code}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge
                      className="rounded-full px-3 py-1 text-xs font-semibold"
                      tone={selectedInvite.active ? "accent" : "neutral"}
                    >
                      {selectedInvite.active ? "active" : "inactive"}
                    </Badge>
                    <Badge className="rounded-full px-3 py-1 text-xs font-semibold">
                      {selectedInvite.defaultRole.toLowerCase()}
                    </Badge>
                  </div>
                </div>

                <dl className="mt-6 space-y-3 text-sm text-[var(--color-text-muted)]">
                  <div className="flex justify-between gap-4">
                    <dt>Invite id</dt>
                    <dd className="max-w-[14rem] truncate text-right">
                      {selectedInvite.id}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Space id</dt>
                    <dd className="max-w-[14rem] truncate text-right">
                      {selectedInvite.spaceId}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Created by</dt>
                    <dd>{selectedInvite.createdByName ?? "Unknown user"}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Created</dt>
                    <dd>{formatDateTime(selectedInvite.createdAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Expires</dt>
                    <dd>{formatDateTime(selectedInvite.expiration)}</dd>
                  </div>
                </dl>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {selectedInviteStats.map((stat) => (
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

          {selectedInvite ? (
            <Panel className="p-6">
              <p className="eyebrow">Global admin action</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Revoke invite
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
                This revokes the selected invite through the instance-wide admin
                API. It is separate from normal Space invite creation or member
                collaboration flows.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  className="button-secondary"
                  to={`/app/admin/spaces?space=${selectedInvite.spaceId}`}
                >
                  Open admin Space oversight
                </Link>
                <Link
                  className="button-secondary"
                  to={`/app/spaces/${selectedInvite.spaceId}`}
                >
                  Open member-facing Space
                </Link>
              </div>

              {selectedInvite.active ? (
                <EmptyHint className="mt-5 px-5 py-5 leading-7">
                  Revocation is intended for global moderation or access control
                  interventions. The invite link remains visible in the audit
                  inventory but becomes inactive.
                </EmptyHint>
              ) : (
                <EmptyHint className="mt-5 px-5 py-5 leading-7">
                  This invite is already inactive. No further admin action is
                  required unless you need to review the owning Space.
                </EmptyHint>
              )}

              <Form className="mt-5" method="post">
                <input
                  name="inviteId"
                  type="hidden"
                  value={selectedInvite.id}
                />
                <button
                  className="button-primary"
                  disabled={isSubmitting || !selectedInvite.active}
                  type="submit"
                >
                  {isSubmitting ? "Revoking invite..." : "Revoke invite"}
                </button>
              </Form>
            </Panel>
          ) : null}
        </div>
      </section>
    </div>
  );
}
