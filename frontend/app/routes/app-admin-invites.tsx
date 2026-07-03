import type { Route } from "./+types/app-admin-invites";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useFetcher,
  useNavigation,
  useRevalidator,
  useSearchParams,
} from "react-router";
import { Check, Copy, Link2, Search } from "lucide-react";
import {
  ABadge,
  ABar,
  AConfirm,
  AEmpty,
  APager,
  ASkeletonRows,
  ATableError,
  type ABadgeTone,
} from "~/components/admin/ui";
import { fmtDate, fmtNum, formatRelativeCount } from "~/lib/admin-format";
import {
  isBackendUnavailableError,
  listAdminInvites,
  revokeAdminInvite,
} from "~/lib/api";
import { toErrorMessage } from "~/lib/errors";
import {
  getActiveLocale,
  translateMessage,
  useI18n,
  type MessageKey,
} from "~/lib/i18n";
import { toActionErrorMessage } from "~/lib/route-actions";
import type { AdminInviteLinkDto, PageResponse, SpaceRole } from "~/types/api";

interface AdminInvitesLoaderData {
  page: PageResponse<AdminInviteLinkDto>;
  listError: string | null;
  activeFilter: boolean | null;
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
  | { ok: true; inviteId: string }
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
  const activeFilter = parseActiveFilter(url.searchParams.get("active"));
  const spaceIdFilter = url.searchParams.get("spaceId")?.trim() ?? "";

  let invitesPage = EMPTY_PAGE;
  let listError: string | null = null;
  try {
    invitesPage = await listAdminInvites({
      page,
      size: 20,
      needsTotal: true,
      active: activeFilter,
      spaceId: spaceIdFilter || null,
    });
  } catch (error) {
    if (isBackendUnavailableError(error)) {
      throw error;
    }
    listError = toErrorMessage(
      error,
      translateMessage(getActiveLocale(), "app.admin.invites.loadFailed"),
    );
  }

  return { page: invitesPage, listError, activeFilter, spaceIdFilter };
}

export async function clientAction({
  request,
}: Route.ClientActionArgs): Promise<RevokeAdminInviteActionResult> {
  const formData = await request.formData();
  const inviteId = String(formData.get("inviteId") ?? "").trim() || null;

  if (!inviteId) {
    return {
      ok: false,
      errorMessage: translateMessage(
        getActiveLocale(),
        "app.admin.invites.revokeFailed",
      ),
      inviteId: null,
    };
  }

  try {
    await revokeAdminInvite(inviteId);
    return { ok: true, inviteId };
  } catch (error) {
    return {
      ok: false,
      errorMessage: toActionErrorMessage(
        error,
        translateMessage(getActiveLocale(), "app.admin.invites.revokeFailed"),
      ),
      inviteId,
    };
  }
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "Admin Invites | PINA" }];
}

const ROLE_TONE: Record<SpaceRole, ABadgeTone> = {
  OWNER: "danger",
  ADMIN: "accent",
  MEMBER: "primary",
  VIEWER: "subtle",
};

type InviteStatus = "active" | "expired" | "exhausted" | "revoked";

function inviteStatus(invite: AdminInviteLinkDto, now: number): InviteStatus {
  if (!invite.active) {
    return "revoked";
  }
  if (invite.expiration && new Date(invite.expiration).getTime() < now) {
    return "expired";
  }
  if (invite.usageLimit != null && invite.usageCount >= invite.usageLimit) {
    return "exhausted";
  }
  return "active";
}

const STATUS_TONE: Record<InviteStatus, ABadgeTone> = {
  active: "success",
  expired: "warn",
  exhausted: "warn",
  revoked: "danger",
};

const STATUS_KEY: Record<InviteStatus, MessageKey> = {
  active: "app.admin.invites.statusActive",
  expired: "app.admin.invites.statusExpired",
  exhausted: "app.admin.invites.statusExhausted",
  revoked: "app.admin.invites.statusRevoked",
};

export default function AppAdminInvitesRoute({
  loaderData,
}: Route.ComponentProps) {
  const { t } = useI18n();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const fetcher = useFetcher<RevokeAdminInviteActionResult>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState<AdminInviteLinkDto | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [toast, setToast] = useState<{ label: string; ok: boolean } | null>(
    null,
  );
  const toastTimer = useRef<number | null>(null);
  const pendingToast = useRef<string | null>(null);

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
    } else if (!fetcher.data.ok) {
      showToast(fetcher.data.errorMessage, false);
    }
    pendingToast.current = null;
    setConfirm(null);
  }, [fetcher.state, fetcher.data]);

  const page = loaderData.page;
  const loading = navigation.state === "loading";
  const busy = fetcher.state !== "idle";
  const [now] = useState(() => Date.now());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? page.items.filter(
          (invite) =>
            invite.code.toLowerCase().includes(q) ||
            invite.spaceName.toLowerCase().includes(q),
        )
      : page.items;
  }, [page.items, query]);

  function goToPage(next: number) {
    const nextParams = new URLSearchParams(searchParams);
    if (next <= 0) {
      nextParams.delete("page");
    } else {
      nextParams.set("page", String(next));
    }
    setSearchParams(nextParams, { replace: true });
  }

  function copyCode(code: string) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).catch(() => {});
    }
    setCopied(code);
    window.setTimeout(
      () => setCopied((current) => (current === code ? null : current)),
      1400,
    );
  }

  return (
    <>
      <div className="adm-section-head">
        <div>
          <h2 className="adm-section-title">{t("app.admin.nav.invites")}</h2>
          <p className="adm-section-sub">
            {t("app.admin.invites.sub", {
              count: formatRelativeCount(page.totalItems ?? page.items.length, {
                one: t("app.admin.invites.linkOne"),
                few: t("app.admin.invites.linkFew"),
                many: t("app.admin.invites.linkMany"),
                other: t("app.admin.invites.linkOther"),
              }),
            })}
          </p>
        </div>
      </div>

      <div className="adm-toolbar">
        <div className="adm-search">
          <span>
            <Search size={15} />
          </span>
          <input
            aria-label={t("app.admin.invites.searchAria")}
            className="field"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("app.admin.invites.searchPlaceholder")}
            type="search"
            value={query}
          />
        </div>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>{t("app.admin.invites.colCode")}</th>
              <th>{t("app.admin.invites.colSpace")}</th>
              <th>{t("app.admin.invites.colRole")}</th>
              <th>{t("app.admin.invites.colExpiry")}</th>
              <th>{t("app.admin.invites.colUsage")}</th>
              <th>{t("app.admin.invites.colStatus")}</th>
              <th>{t("app.admin.invites.colCreated")}</th>
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
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 0 }}>
                  <AEmpty
                    icon={<Link2 size={22} />}
                    text={t("app.admin.invites.emptyText")}
                    title={t("app.admin.invites.emptyTitle")}
                  />
                </td>
              </tr>
            ) : (
              filtered.map((invite) => {
                const status = inviteStatus(invite, now);
                const usePct =
                  invite.usageLimit != null && invite.usageLimit > 0
                    ? Math.round((invite.usageCount / invite.usageLimit) * 100)
                    : null;
                return (
                  <tr
                    className={status === "active" ? "" : "dim"}
                    key={invite.id}
                  >
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: ".4rem",
                        }}
                      >
                        <span className="adm-mono">{invite.code}</span>
                        <button
                          aria-label={t("app.admin.invites.copy")}
                          className="adm-icon-btn"
                          onClick={() => copyCode(invite.code)}
                          title={t("app.admin.invites.copy")}
                          type="button"
                        >
                          {copied === invite.code ? (
                            <Check size={14} />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                    </td>
                    <td>
                      <span
                        className="adm-cell-sub"
                        style={{ color: "var(--color-text)" }}
                      >
                        {invite.spaceName}
                      </span>
                    </td>
                    <td>
                      <ABadge tone={ROLE_TONE[invite.defaultRole]}>
                        {invite.defaultRole}
                      </ABadge>
                    </td>
                    <td>
                      <span className="adm-cell-sub">
                        {invite.expiration
                          ? fmtDate(invite.expiration)
                          : t("app.admin.invites.noExpiry")}
                      </span>
                    </td>
                    <td>
                      <div style={{ minWidth: "6.5rem" }}>
                        <div
                          className="adm-cell-sub"
                          style={{ marginBottom: ".25rem" }}
                        >
                          {fmtNum(invite.usageCount)}
                          {invite.usageLimit != null
                            ? ` / ${fmtNum(invite.usageLimit)}`
                            : ` / ${t("app.admin.invites.unlimited")}`}
                        </div>
                        {usePct != null ? (
                          <ABar pct={usePct} danger={usePct >= 100} mini />
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <ABadge
                        dot={status === "active"}
                        tone={STATUS_TONE[status]}
                      >
                        {t(STATUS_KEY[status])}
                      </ABadge>
                    </td>
                    <td>
                      <span className="adm-cell-sub">
                        {invite.createdByName
                          ? `${invite.createdByName} · `
                          : ""}
                        {fmtDate(invite.createdAt)}
                      </span>
                    </td>
                    <td>
                      <div className="adm-row-actions">
                        <button
                          className="adm-text-btn danger"
                          disabled={!invite.active || busy}
                          onClick={() => setConfirm(invite)}
                          type="button"
                        >
                          {t("app.admin.invites.revoke")}
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
          onPage={goToPage}
          page={page.page + 1}
          pageCount={page.totalPages ?? 1}
          total={page.totalItems ?? page.items.length}
        />
      </div>

      {confirm ? (
        <AConfirm
          busy={busy}
          callout={t("app.admin.invites.revokeCallout")}
          confirmIcon={<Link2 size={15} />}
          confirmLabel={t("app.admin.invites.revokeBtn")}
          icon={<Link2 size={22} />}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            pendingToast.current = t("app.admin.invites.toastRevoked", {
              code: confirm.code,
            });
            fetcher.submit({ inviteId: confirm.id }, { method: "post" });
          }}
          title={t("app.admin.invites.revokeTitle")}
          tone="danger"
        >
          {t("app.admin.invites.revokeBody", {
            code: confirm.code,
            space: confirm.spaceName,
          })}
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
