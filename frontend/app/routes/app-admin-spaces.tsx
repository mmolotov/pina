import type { Route } from "./+types/app-admin-spaces";
import { useEffect, useRef, useState } from "react";
import {
  useFetcher,
  useNavigation,
  useRevalidator,
  useSearchParams,
} from "react-router";
import { ChevronRight, Layers, Search, Trash2 } from "lucide-react";
import {
  ABadge,
  AConfirm,
  AEmpty,
  APager,
  ASkeletonRows,
  ATableError,
} from "~/components/admin/ui";
import { fmtDate, fmtNum, formatRelativeCount } from "~/lib/admin-format";
import {
  deleteAdminSpace,
  isBackendUnavailableError,
  listAdminSpaces,
} from "~/lib/api";
import { toErrorMessage } from "~/lib/errors";
import { getActiveLocale, translateMessage, useI18n } from "~/lib/i18n";
import { toActionErrorMessage } from "~/lib/route-actions";
import type { AdminSpaceDto, PageResponse } from "~/types/api";

interface AdminSpacesLoaderData {
  page: PageResponse<AdminSpaceDto>;
  listError: string | null;
  search: string;
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
  | { ok: true; spaceId: string }
  | { ok: false; errorMessage: string; spaceId: string | null };

export async function clientLoader({
  request,
}: Route.ClientLoaderArgs): Promise<AdminSpacesLoaderData> {
  const url = new URL(request.url);
  const pageParam = Number(url.searchParams.get("page") ?? "0");
  const page = Number.isFinite(pageParam) && pageParam >= 0 ? pageParam : 0;
  const search = url.searchParams.get("search")?.trim() ?? "";

  let listError: string | null = null;
  let spacesPage = EMPTY_PAGE;
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
    listError = toErrorMessage(
      error,
      translateMessage(getActiveLocale(), "app.admin.spaces.loadFailed"),
    );
  }

  return { page: spacesPage, listError, search };
}

export async function clientAction({
  request,
}: Route.ClientActionArgs): Promise<DeleteAdminSpaceActionResult> {
  const formData = await request.formData();
  const spaceId = String(formData.get("spaceId") ?? "").trim() || null;

  if (!spaceId) {
    return {
      ok: false,
      errorMessage: translateMessage(
        getActiveLocale(),
        "app.admin.spaces.deleteFailed",
      ),
      spaceId: null,
    };
  }

  try {
    await deleteAdminSpace(spaceId);
    return { ok: true, spaceId };
  } catch (error) {
    return {
      ok: false,
      errorMessage: toActionErrorMessage(
        error,
        translateMessage(getActiveLocale(), "app.admin.spaces.deleteFailed"),
      ),
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
  const { t } = useI18n();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const fetcher = useFetcher<DeleteAdminSpaceActionResult>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(loaderData.search);
  const [confirm, setConfirm] = useState<AdminSpaceDto | null>(null);
  const [toast, setToast] = useState<{ label: string; ok: boolean } | null>(
    null,
  );
  const toastTimer = useRef<number | null>(null);
  const pendingToast = useRef<string | null>(null);

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
    } else if (!fetcher.data.ok) {
      showToast(fetcher.data.errorMessage, false);
    }
    pendingToast.current = null;
    setConfirm(null);
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

  return (
    <>
      <div className="adm-section-head">
        <div>
          <h2 className="adm-section-title">{t("app.admin.nav.spaces")}</h2>
          <p className="adm-section-sub">
            {t("app.admin.spaces.sub", {
              count: formatRelativeCount(totalItems, {
                one: t("app.admin.spaces.spaceOne"),
                few: t("app.admin.spaces.spaceFew"),
                many: t("app.admin.spaces.spaceMany"),
                other: t("app.admin.spaces.spaceOther"),
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
            aria-label={t("app.admin.spaces.searchAria")}
            className="field"
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder={t("app.admin.spaces.searchPlaceholder")}
            type="search"
            value={searchDraft}
          />
        </div>
      </form>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>{t("app.admin.spaces.colSpace")}</th>
              <th>{t("app.admin.spaces.colVisibility")}</th>
              <th>{t("app.admin.spaces.colCreator")}</th>
              <th className="num">{t("app.admin.spaces.colMembers")}</th>
              <th className="num">{t("app.admin.spaces.colAlbums")}</th>
              <th className="num">{t("app.admin.spaces.colPhotos")}</th>
              <th>{t("app.admin.spaces.colCreated")}</th>
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
                    icon={<Layers size={22} />}
                    text={t("app.admin.spaces.emptyText")}
                    title={t("app.admin.spaces.emptyTitle")}
                  />
                </td>
              </tr>
            ) : (
              page.items.map((space) => (
                <tr key={space.id}>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: ".5rem",
                        paddingLeft: `${space.depth * 1.1}rem`,
                      }}
                    >
                      {space.depth > 0 ? (
                        <span
                          style={{
                            color: "var(--color-text-muted)",
                            flexShrink: 0,
                          }}
                        >
                          <ChevronRight size={13} />
                        </span>
                      ) : null}
                      <div style={{ minWidth: 0 }}>
                        <div className="adm-cell-name">{space.name}</div>
                        <div
                          className="adm-cell-sub"
                          style={{
                            maxWidth: "20rem",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {space.description?.trim() ||
                            t("app.admin.spaces.noDescription")}
                          {space.depth > 0
                            ? ` · ${t("app.admin.spaces.level", { level: space.depth })}`
                            : ""}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <ABadge
                      tone={
                        space.visibility === "PUBLIC" ? "primary" : "subtle"
                      }
                    >
                      {space.visibility}
                    </ABadge>
                  </td>
                  <td>
                    <span className="adm-cell-sub">{space.creatorName}</span>
                  </td>
                  <td className="num">{fmtNum(space.memberCount)}</td>
                  <td className="num">{fmtNum(space.albumCount)}</td>
                  <td className="num">{fmtNum(space.photoCount)}</td>
                  <td>
                    <span className="adm-cell-sub">
                      {fmtDate(space.createdAt)}
                    </span>
                  </td>
                  <td>
                    <div className="adm-row-actions">
                      <button
                        aria-label={t("app.admin.spaces.deleteAria")}
                        className="adm-icon-btn danger"
                        disabled={busy}
                        onClick={() => setConfirm(space)}
                        title={t("app.admin.spaces.deleteAria")}
                        type="button"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
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

      {confirm ? (
        <AConfirm
          busy={busy}
          callout={t("app.admin.spaces.deleteCallout")}
          confirmIcon={<Trash2 size={15} />}
          confirmLabel={t("app.admin.spaces.deleteBtn")}
          icon={<Trash2 size={22} />}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            pendingToast.current = t("app.admin.spaces.toastDeleted");
            fetcher.submit({ spaceId: confirm.id }, { method: "post" });
          }}
          title={t("app.admin.spaces.deleteTitle")}
          tone="danger"
        >
          {t("app.admin.spaces.deleteBody", {
            name: confirm.name,
            count: fmtNum(confirm.photoCount),
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
