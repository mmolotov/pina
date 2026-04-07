import type { Route } from "./+types/app-admin-users";
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
  getAdminUser,
  isBackendUnavailableError,
  listAdminUsers,
  updateAdminUser,
} from "~/lib/api";
import { toErrorMessage } from "~/lib/errors";
import { formatBytes, formatDateTime } from "~/lib/format";
import { toActionErrorMessage } from "~/lib/route-actions";
import { useSession } from "~/lib/session";
import type { AdminUserDto, PageResponse } from "~/types/api";

interface AdminUsersLoaderData {
  page: PageResponse<AdminUserDto>;
  selectedUser: AdminUserDto | null;
  selectedUserError: string | null;
  listError: string | null;
  search: string;
  selectedUserId: string | null;
}

const EMPTY_PAGE: PageResponse<AdminUserDto> = {
  items: [],
  page: 0,
  size: 20,
  hasNext: false,
  totalItems: 0,
  totalPages: 0,
};

interface UserDraft {
  instanceRole: "USER" | "ADMIN";
  active: boolean;
}

type UpdateAdminUserActionResult =
  | { ok: true; successMessage: string; userId: string }
  | { ok: false; errorMessage: string; userId: string | null };

export async function clientLoader({
  request,
}: Route.ClientLoaderArgs): Promise<AdminUsersLoaderData> {
  const url = new URL(request.url);
  const pageParam = Number(url.searchParams.get("page") ?? "0");
  const page = Number.isFinite(pageParam) && pageParam >= 0 ? pageParam : 0;
  const search = url.searchParams.get("search")?.trim() ?? "";
  const selectedUserId = url.searchParams.get("user");

  let listError: string | null = null;
  let selectedUserError: string | null = null;
  let usersPage = EMPTY_PAGE;
  let selectedUser: AdminUserDto | null = null;

  try {
    usersPage = await listAdminUsers({
      page,
      size: 20,
      needsTotal: true,
      search,
    });
  } catch (error) {
    if (isBackendUnavailableError(error)) {
      throw error;
    }

    listError = toErrorMessage(error, "Failed to load admin users.");
  }

  if (selectedUserId && !listError) {
    try {
      selectedUser = await getAdminUser(selectedUserId);
    } catch (error) {
      if (isBackendUnavailableError(error)) {
        throw error;
      }

      selectedUserError = toErrorMessage(error, "Failed to load user details.");
    }
  }

  return {
    page: usersPage,
    selectedUser,
    selectedUserError,
    listError,
    search,
    selectedUserId,
  };
}

export async function clientAction({
  request,
}: Route.ClientActionArgs): Promise<UpdateAdminUserActionResult> {
  const formData = await request.formData();
  const userId = String(formData.get("userId") ?? "").trim() || null;

  if (!userId) {
    return {
      ok: false,
      errorMessage: "User id is required.",
      userId: null,
    };
  }

  const instanceRoleValue = String(formData.get("instanceRole") ?? "").trim();
  const activeValue = String(formData.get("active") ?? "").trim();

  try {
    await updateAdminUser(userId, {
      instanceRole:
        instanceRoleValue === "ADMIN" || instanceRoleValue === "USER"
          ? instanceRoleValue
          : null,
      active:
        activeValue === "true" ? true : activeValue === "false" ? false : null,
    });

    return {
      ok: true,
      successMessage: "User updated.",
      userId,
    };
  } catch (error) {
    return {
      ok: false,
      errorMessage: toActionErrorMessage(error, "Failed to update user."),
      userId,
    };
  }
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "Admin Users | PINA" }];
}

export default function AppAdminUsersRoute({
  loaderData,
}: Route.ComponentProps) {
  const session = useSession();
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(loaderData.search);
  const [draft, setDraft] = useState<UserDraft | null>(
    loaderData.selectedUser
      ? {
          instanceRole: loaderData.selectedUser.instanceRole,
          active: loaderData.selectedUser.active,
        }
      : null,
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isSaving = navigation.state !== "idle";
  const currentPage = loaderData.page.page;
  const hasPreviousPage = currentPage > 0;
  const totalItems = loaderData.page.totalItems ?? loaderData.page.items.length;
  const selectedUser = loaderData.selectedUser;
  const isSelectedSelf = selectedUser?.id === session?.user.id;

  useEffect(() => {
    setSearchDraft(loaderData.search);
  }, [loaderData.search]);

  useEffect(() => {
    if (!selectedUser) {
      setDraft(null);
      return;
    }

    setDraft({
      instanceRole: selectedUser.instanceRole,
      active: selectedUser.active,
    });
  }, [selectedUser]);

  useEffect(() => {
    if (!actionData) {
      return;
    }

    if (actionData.ok) {
      setSuccessMessage(actionData.successMessage);
      revalidator.revalidate();
      return;
    }

    setSuccessMessage(null);
  }, [actionData, revalidator]);

  const errorMessage =
    actionData && !actionData.ok ? actionData.errorMessage : null;
  const hasDraftChanges =
    selectedUser != null &&
    draft != null &&
    (draft.instanceRole !== selectedUser.instanceRole ||
      draft.active !== selectedUser.active);

  const selectedUserStats = useMemo(
    () =>
      selectedUser
        ? [
            {
              label: "Providers",
              value:
                selectedUser.providers.length > 0
                  ? selectedUser.providers.join(", ")
                  : "Local only",
            },
            {
              label: "Photos",
              value: String(selectedUser.photoCount),
            },
            {
              label: "Storage",
              value: formatBytes(selectedUser.storageBytesUsed),
            },
          ]
        : [],
    [selectedUser],
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
            <Link className="button-secondary" to="/app/settings">
              Open profile settings
            </Link>
          </>
        }
        description="Browse instance users, inspect identity and usage details, and apply supported instance-role or activation changes."
        eyebrow="Admin users"
        title="User management"
      />

      <Panel className="p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="eyebrow">Browse users</p>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Search by name or email and keep the selected user in the current
              route state.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
            <input
              aria-label="Search users"
              className="field min-w-0 md:min-w-80"
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search by name or email"
              type="search"
              value={searchDraft}
            />
            <button
              className="button-secondary"
              onClick={() => {
                setSuccessMessage(null);
                updateParams(
                  { search: searchDraft.trim() || null, user: null },
                  {
                    resetPage: true,
                  },
                );
              }}
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
                setSuccessMessage(null);
                updateParams({ search: null, user: null }, { resetPage: true });
              }}
              type="button"
            >
              Clear
            </button>
          </div>
        </div>
      </Panel>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_0.9fr]">
        <Panel className="p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Users</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Instance accounts
              </h2>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                {totalItems} total matching account
                {totalItems === 1 ? "" : "s"} · page {currentPage + 1}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="button-secondary"
                disabled={!hasPreviousPage}
                onClick={() => goToPage(currentPage - 1)}
                type="button"
              >
                Previous
              </button>
              <button
                className="button-secondary"
                disabled={!loaderData.page.hasNext}
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
              No users match the current filters.
            </EmptyHint>
          ) : (
            <div className="mt-6 space-y-3">
              {loaderData.page.items.map((user) => {
                const isSelected = user.id === loaderData.selectedUserId;
                const itemParams = new URLSearchParams(searchParams);
                itemParams.set("user", user.id);

                return (
                  <Link
                    className={[
                      "surface-card block rounded-2xl p-4 transition-transform duration-150 hover:-translate-y-0.5",
                      isSelected ? "border border-[var(--color-accent)]" : "",
                    ]
                      .join(" ")
                      .trim()}
                    key={user.id}
                    to={`/app/admin/users?${itemParams.toString()}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold tracking-tight">
                          {user.name}
                        </h3>
                        <p className="mt-1 truncate text-sm text-[var(--color-text-muted)]">
                          {user.email ?? "No email configured"}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Badge
                          className="rounded-full px-3 py-1 text-xs font-semibold"
                          tone={
                            user.instanceRole === "ADMIN" ? "accent" : "neutral"
                          }
                        >
                          {user.instanceRole.toLowerCase()}
                        </Badge>
                        <Badge className="rounded-full px-3 py-1 text-xs font-semibold">
                          {user.active ? "active" : "inactive"}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-[var(--color-text-muted)] sm:grid-cols-3">
                      <span>{user.providers.join(", ") || "Local only"}</span>
                      <span>{user.photoCount} photos</span>
                      <span>{formatBytes(user.storageBytesUsed)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          {loaderData.selectedUserError ? (
            <InlineMessage tone="danger">
              {loaderData.selectedUserError}
            </InlineMessage>
          ) : null}

          {!selectedUser ? (
            <SurfaceCard className="rounded-3xl p-5" tone="subtle">
              <p className="eyebrow">User detail</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">
                Select an account
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
                Pick a user from the list to inspect identity, provider,
                lifecycle, and storage details, then apply supported admin
                changes.
              </p>
            </SurfaceCard>
          ) : (
            <>
              <Panel className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="eyebrow">User detail</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                      {selectedUser.name}
                    </h2>
                    <p className="mt-2 break-all text-sm text-[var(--color-text-muted)]">
                      {selectedUser.email ?? "No email configured"}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge
                      className="rounded-full px-3 py-1 text-xs font-semibold"
                      tone={
                        selectedUser.instanceRole === "ADMIN"
                          ? "accent"
                          : "neutral"
                      }
                    >
                      {selectedUser.instanceRole.toLowerCase()}
                    </Badge>
                    <Badge className="rounded-full px-3 py-1 text-xs font-semibold">
                      {selectedUser.active ? "active" : "inactive"}
                    </Badge>
                  </div>
                </div>

                <dl className="mt-6 space-y-3 text-sm text-[var(--color-text-muted)]">
                  <div className="flex justify-between gap-4">
                    <dt>User id</dt>
                    <dd className="max-w-[14rem] truncate text-right">
                      {selectedUser.id}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Created</dt>
                    <dd>{formatDateTime(selectedUser.createdAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Updated</dt>
                    <dd>{formatDateTime(selectedUser.updatedAt)}</dd>
                  </div>
                  {selectedUserStats.map((stat) => (
                    <div
                      className="flex justify-between gap-4"
                      key={stat.label}
                    >
                      <dt>{stat.label}</dt>
                      <dd>{stat.value}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>

              <Panel className="p-6">
                <p className="eyebrow">Admin actions</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  Account status and role
                </h2>
                <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
                  Update the instance role or activation state supported by the
                  backend admin API.
                </p>

                {isSelectedSelf ? (
                  <InlineMessage className="mt-5" tone="danger">
                    You cannot demote or deactivate your own admin account from
                    this screen.
                  </InlineMessage>
                ) : null}

                <Form className="mt-5 space-y-4" method="post">
                  <input name="userId" type="hidden" value={selectedUser.id} />

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium">
                      Instance role
                    </span>
                    <select
                      aria-label="Instance role"
                      className="field"
                      disabled={isSelectedSelf}
                      name="instanceRole"
                      onChange={(event) => {
                        setSuccessMessage(null);
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                instanceRole: event.target.value as
                                  | "USER"
                                  | "ADMIN",
                              }
                            : current,
                        );
                      }}
                      value={draft?.instanceRole ?? selectedUser.instanceRole}
                    >
                      <option value="USER">User</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium">
                      Account status
                    </span>
                    <select
                      aria-label="Account status"
                      className="field"
                      disabled={isSelectedSelf}
                      name="active"
                      onChange={(event) => {
                        setSuccessMessage(null);
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                active: event.target.value === "true",
                              }
                            : current,
                        );
                      }}
                      value={String(draft?.active ?? selectedUser.active)}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </label>

                  {errorMessage ? (
                    <InlineMessage tone="danger">{errorMessage}</InlineMessage>
                  ) : null}

                  {successMessage ? (
                    <InlineMessage tone="success">
                      {successMessage}
                    </InlineMessage>
                  ) : null}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      className="button-primary"
                      disabled={isSaving || !hasDraftChanges || isSelectedSelf}
                      type="submit"
                    >
                      {isSaving ? "Saving..." : "Save changes"}
                    </button>
                    <button
                      className="button-secondary"
                      disabled={!hasDraftChanges || isSaving}
                      onClick={() => {
                        setSuccessMessage(null);
                        setDraft({
                          instanceRole: selectedUser.instanceRole,
                          active: selectedUser.active,
                        });
                      }}
                      type="button"
                    >
                      Reset
                    </button>
                  </div>
                </Form>
              </Panel>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
