import type { Route } from "./+types/app-admin-users";
import { useEffect, useRef, useState } from "react";
import {
  useFetcher,
  useNavigation,
  useRevalidator,
  useSearchParams,
} from "react-router";
import { Power, Search, UserCog } from "lucide-react";
import {
  ABadge,
  AConfirm,
  AEmpty,
  APager,
  ASkeletonRows,
  ATableError,
  type ABadgeTone,
} from "~/components/admin/ui";
import {
  avatarIndex,
  fmtBytes,
  fmtDate,
  fmtNum,
  formatRelativeCount,
  initials,
} from "~/lib/admin-format";
import {
  isBackendUnavailableError,
  listAdminUsers,
  updateAdminUser,
} from "~/lib/api";
import { toErrorMessage } from "~/lib/errors";
import { getActiveLocale, translateMessage, useI18n } from "~/lib/i18n";
import { toActionErrorMessage } from "~/lib/route-actions";
import { useSession } from "~/lib/session";
import type { AdminUserDto, PageResponse } from "~/types/api";

interface AdminUsersLoaderData {
  page: PageResponse<AdminUserDto>;
  listError: string | null;
  search: string;
}

const EMPTY_PAGE: PageResponse<AdminUserDto> = {
  items: [],
  page: 0,
  size: 20,
  hasNext: false,
  totalItems: 0,
  totalPages: 0,
};

type UpdateAdminUserActionResult =
  | { ok: true; userId: string }
  | { ok: false; errorMessage: string; userId: string | null };

export async function clientLoader({
  request,
}: Route.ClientLoaderArgs): Promise<AdminUsersLoaderData> {
  const url = new URL(request.url);
  const pageParam = Number(url.searchParams.get("page") ?? "0");
  const page = Number.isFinite(pageParam) && pageParam >= 0 ? pageParam : 0;
  const search = url.searchParams.get("search")?.trim() ?? "";

  let listError: string | null = null;
  let usersPage = EMPTY_PAGE;
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
    listError = toErrorMessage(
      error,
      translateMessage(getActiveLocale(), "app.admin.users.loadFailed"),
    );
  }

  return { page: usersPage, listError, search };
}

export async function clientAction({
  request,
}: Route.ClientActionArgs): Promise<UpdateAdminUserActionResult> {
  const formData = await request.formData();
  const userId = String(formData.get("userId") ?? "").trim() || null;

  if (!userId) {
    return {
      ok: false,
      errorMessage: translateMessage(
        getActiveLocale(),
        "app.admin.users.updateFailed",
      ),
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
    return { ok: true, userId };
  } catch (error) {
    return {
      ok: false,
      errorMessage: toActionErrorMessage(
        error,
        translateMessage(getActiveLocale(), "app.admin.users.updateFailed"),
      ),
      userId,
    };
  }
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "Admin Users | PINA" }];
}

const PROVIDER_TONE: Record<string, ABadgeTone> = {
  LOCAL: "subtle",
  GOOGLE: "primary",
  TELEGRAM: "accent",
};

type ConfirmState = { type: "role" | "status"; user: AdminUserDto } | null;

export default function AppAdminUsersRoute({
  loaderData,
}: Route.ComponentProps) {
  const { t } = useI18n();
  const session = useSession();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const fetcher = useFetcher<UpdateAdminUserActionResult>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(loaderData.search);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [toast, setToast] = useState<{ label: string; ok: boolean } | null>(
    null,
  );
  const pendingToast = useRef<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => setSearchDraft(loaderData.search), [loaderData.search]);
  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = (label: string, ok: boolean) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ label, ok });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) {
      return;
    }
    if (fetcher.data.ok && pendingToast.current) {
      showToast(pendingToast.current, true);
      pendingToast.current = null;
      setConfirm(null);
    } else if (!fetcher.data.ok) {
      showToast(fetcher.data.errorMessage, false);
      pendingToast.current = null;
      setConfirm(null);
    }
  }, [fetcher.state, fetcher.data]);

  const page = loaderData.page;
  const loading = navigation.state === "loading";
  const busy = fetcher.state !== "idle";
  const totalItems = page.totalItems ?? page.items.length;

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

  function applyConfirm() {
    if (!confirm) {
      return;
    }
    const user = confirm.user;
    const fields: Record<string, string> = { userId: user.id };
    if (confirm.type === "role") {
      const next = user.instanceRole === "ADMIN" ? "USER" : "ADMIN";
      fields.instanceRole = next;
      pendingToast.current = t(
        next === "ADMIN"
          ? "app.admin.users.toastRoleAdmin"
          : "app.admin.users.toastRoleUser",
        { name: user.name },
      );
    } else {
      const next = !user.active;
      fields.active = String(next);
      pendingToast.current = t(
        next ? "app.admin.users.toastEnabled" : "app.admin.users.toastDisabled",
        { name: user.name },
      );
    }
    fetcher.submit(fields, { method: "post" });
  }

  return (
    <>
      <div className="adm-section-head">
        <div>
          <h2 className="adm-section-title">{t("app.admin.nav.users")}</h2>
          <p className="adm-section-sub">
            {t("app.admin.users.sub", {
              count: formatRelativeCount(totalItems, {
                one: t("app.admin.users.accountOne"),
                few: t("app.admin.users.accountFew"),
                many: t("app.admin.users.accountMany"),
                other: t("app.admin.users.accountOther"),
              }),
            })}
          </p>
        </div>
      </div>

      <form
        className="adm-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          updateParams(
            { search: searchDraft.trim() || null },
            { resetPage: true },
          );
        }}
      >
        <div className="adm-search">
          <span>
            <Search size={15} />
          </span>
          <input
            aria-label={t("app.admin.users.searchAria")}
            className="field"
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder={t("app.admin.users.searchPlaceholder")}
            type="search"
            value={searchDraft}
          />
        </div>
      </form>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>{t("app.admin.users.colUser")}</th>
              <th>{t("app.admin.users.colProviders")}</th>
              <th>{t("app.admin.users.colRole")}</th>
              <th>{t("app.admin.users.colStatus")}</th>
              <th className="num">{t("app.admin.users.colPhotos")}</th>
              <th className="num">{t("app.admin.users.colStorage")}</th>
              <th>{t("app.admin.users.colCreated")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <ASkeletonRows cols={8} />
            ) : loaderData.listError ? (
              <tr>
                <td colSpan={8} style={{ padding: 0 }}>
                  <ATableError
                    msg={loaderData.listError}
                    onRetry={() => revalidator.revalidate()}
                  />
                </td>
              </tr>
            ) : page.items.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 0 }}>
                  <AEmpty
                    icon={<Search size={22} />}
                    text={t("app.admin.users.emptyText")}
                    title={t("app.admin.users.emptyTitle")}
                  />
                </td>
              </tr>
            ) : (
              page.items.map((user) => {
                const isMe = user.id === session?.user.id;
                return (
                  <tr className={user.active ? "" : "dim"} key={user.id}>
                    <td>
                      <div className="adm-cell-user">
                        <span
                          className="adm-avatar"
                          data-av={avatarIndex(user.id)}
                        >
                          {initials(user.name)}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div className="adm-cell-name">
                            {user.name}
                            {isMe ? (
                              <span
                                style={{
                                  color: "var(--color-text-muted)",
                                  fontWeight: 400,
                                }}
                              >
                                {" "}
                                · {t("app.admin.users.you")}
                              </span>
                            ) : null}
                          </div>
                          <div className="adm-cell-email">
                            {user.email ?? "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="adm-badge-row">
                        {user.providers.map((provider) => (
                          <ABadge
                            key={provider}
                            tone={PROVIDER_TONE[provider] ?? "subtle"}
                          >
                            {provider}
                          </ABadge>
                        ))}
                      </div>
                    </td>
                    <td>
                      <ABadge
                        tone={
                          user.instanceRole === "ADMIN" ? "accent" : "subtle"
                        }
                      >
                        {user.instanceRole}
                      </ABadge>
                    </td>
                    <td>
                      <ABadge dot tone={user.active ? "success" : "danger"}>
                        {t(
                          user.active
                            ? "app.admin.users.statusActive"
                            : "app.admin.users.statusDisabled",
                        )}
                      </ABadge>
                    </td>
                    <td className="num">{fmtNum(user.photoCount)}</td>
                    <td className="num">{fmtBytes(user.storageBytesUsed)}</td>
                    <td>
                      <span className="adm-cell-sub">
                        {fmtDate(user.createdAt)}
                      </span>
                    </td>
                    <td>
                      <div className="adm-row-actions">
                        <button
                          className="adm-text-btn"
                          disabled={isMe || busy}
                          onClick={() => setConfirm({ type: "role", user })}
                          title={
                            isMe
                              ? t("app.admin.users.selfRoleGuard")
                              : undefined
                          }
                          type="button"
                        >
                          {user.instanceRole === "ADMIN"
                            ? t("app.admin.users.removeAdmin")
                            : t("app.admin.users.makeAdmin")}
                        </button>
                        <button
                          aria-label={
                            user.active
                              ? t("app.admin.users.disable")
                              : t("app.admin.users.enable")
                          }
                          className={`adm-icon-btn${user.active ? " danger" : ""}`}
                          disabled={isMe || busy}
                          onClick={() => setConfirm({ type: "status", user })}
                          title={
                            isMe
                              ? t("app.admin.users.selfStatusGuard")
                              : user.active
                                ? t("app.admin.users.disable")
                                : t("app.admin.users.enable")
                          }
                          type="button"
                        >
                          <Power size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <APager
          onPage={(next) => updateParams({ page: String(next - 1) })}
          page={page.page + 1}
          pageCount={page.totalPages ?? 1}
          total={totalItems}
        />
      </div>

      {confirm && confirm.type === "role" ? (
        <AConfirm
          busy={busy}
          confirmIcon={<UserCog size={15} />}
          confirmLabel={
            confirm.user.instanceRole === "ADMIN"
              ? t("app.admin.users.revokeBtn")
              : t("app.admin.users.grantBtn")
          }
          callout={
            confirm.user.instanceRole === "ADMIN"
              ? undefined
              : t("app.admin.users.grantCallout")
          }
          icon={<UserCog size={22} />}
          onCancel={() => setConfirm(null)}
          onConfirm={applyConfirm}
          title={
            confirm.user.instanceRole === "ADMIN"
              ? t("app.admin.users.revokeTitle")
              : t("app.admin.users.grantTitle")
          }
          tone={confirm.user.instanceRole === "ADMIN" ? "accent" : "accent"}
        >
          {t(
            confirm.user.instanceRole === "ADMIN"
              ? "app.admin.users.revokeBody"
              : "app.admin.users.grantBody",
            { name: confirm.user.name },
          )}
        </AConfirm>
      ) : null}

      {confirm && confirm.type === "status" ? (
        <AConfirm
          busy={busy}
          confirmIcon={<Power size={15} />}
          confirmLabel={
            confirm.user.active
              ? t("app.admin.users.disable")
              : t("app.admin.users.enable")
          }
          callout={
            confirm.user.active
              ? t("app.admin.users.disableCallout")
              : undefined
          }
          icon={<Power size={22} />}
          onCancel={() => setConfirm(null)}
          onConfirm={applyConfirm}
          title={
            confirm.user.active
              ? t("app.admin.users.disableTitle")
              : t("app.admin.users.enableTitle")
          }
          tone={confirm.user.active ? "danger" : "accent"}
        >
          {t(
            confirm.user.active
              ? "app.admin.users.disableBody"
              : "app.admin.users.enableBody",
            { name: confirm.user.name },
          )}
        </AConfirm>
      ) : null}

      {toast ? (
        <div className={`adm-toast${toast.ok ? " ok" : ""}`} role="status">
          {toast.label}
        </div>
      ) : null}
    </>
  );
}
