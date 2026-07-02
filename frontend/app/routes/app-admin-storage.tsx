import type { Route } from "./+types/app-admin-storage";
import { useState } from "react";
import { useSearchParams } from "react-router";
import {
  AlertTriangle,
  Database,
  HardDrive,
  ImageIcon,
  Server,
} from "lucide-react";
import { ABar, AEmpty, APager } from "~/components/admin/ui";
import { avatarIndex, fmtBytes, fmtNum, initials } from "~/lib/admin-format";
import {
  getAdminStorageSummary,
  isBackendUnavailableError,
  listAdminStorageSpaces,
  listAdminStorageUsers,
} from "~/lib/api";
import { toErrorMessage } from "~/lib/errors";
import { getActiveLocale, translateMessage, useI18n } from "~/lib/i18n";
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
  spacesPage: PageResponse<AdminSpaceStorageDto>;
  loadError: string | null;
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

  const fallback = translateMessage(
    getActiveLocale(),
    "app.admin.storage.loadFailed",
  );
  let summary: AdminStorageSummaryDto | null = null;
  let summaryError: string | null = null;
  let usersPage = EMPTY_USER_PAGE;
  let spacesPage = EMPTY_SPACE_PAGE;
  let loadError: string | null = null;

  try {
    summary = await getAdminStorageSummary();
  } catch (error) {
    if (isBackendUnavailableError(error)) {
      throw error;
    }
    summaryError = toErrorMessage(error, fallback);
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
    loadError = toErrorMessage(error, fallback);
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
    loadError = toErrorMessage(error, fallback);
  }

  return { summary, summaryError, usersPage, spacesPage, loadError };
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "Admin Storage | PINA" }];
}

export default function AppAdminStorageRoute({
  loaderData,
}: Route.ComponentProps) {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<"users" | "spaces">("users");

  const summary = loaderData.summary;
  const usersPage = loaderData.usersPage;
  const spacesPage = loaderData.spacesPage;

  const fsTotal = summary
    ? summary.filesystemUsedBytes + summary.filesystemAvailableBytes
    : 0;
  const fsPct =
    summary && fsTotal > 0
      ? Math.round((summary.filesystemUsedBytes / fsTotal) * 100)
      : 0;

  const maxUserBytes = Math.max(
    1,
    ...usersPage.items.map((row) => row.storageBytesUsed),
  );
  const maxSpacePhotos = Math.max(
    1,
    ...spacesPage.items.map((row) => row.photoCount),
  );

  const kpis = summary
    ? [
        {
          label: t("app.admin.storage.kpiProvider"),
          value: summary.storageProvider,
          Icon: Server,
          wide: true,
        },
        {
          label: t("app.admin.storage.kpiPhotos"),
          value: fmtNum(summary.totalPhotos),
          Icon: ImageIcon,
        },
        {
          label: t("app.admin.storage.kpiVariants"),
          value: fmtNum(summary.totalVariants),
          Icon: Database,
        },
        {
          label: t("app.admin.storage.kpiLogical"),
          value: fmtBytes(summary.totalStorageBytes),
          Icon: HardDrive,
        },
      ]
    : [];

  function goToPage(param: "userPage" | "spacePage", next: number) {
    const nextParams = new URLSearchParams(searchParams);
    if (next <= 0) {
      nextParams.delete(param);
    } else {
      nextParams.set(param, String(next));
    }
    setSearchParams(nextParams, { replace: true });
  }

  return (
    <>
      <div className="adm-section-head">
        <div>
          <h2 className="adm-section-title">{t("app.admin.storage.title")}</h2>
          <p className="adm-section-sub">{t("app.admin.storage.sub")}</p>
        </div>
      </div>

      {summary ? (
        <>
          <div className="adm-kpi-grid">
            {kpis.map((kpi) => (
              <div className="adm-kpi" key={kpi.label}>
                <span className="adm-kpi-label">
                  <kpi.Icon size={14} /> {kpi.label}
                </span>
                <span
                  className="adm-kpi-value"
                  style={
                    kpi.wide ? { fontSize: "1rem", lineHeight: 1.3 } : undefined
                  }
                >
                  {kpi.value}
                </span>
              </div>
            ))}
          </div>

          <div className="adm-card">
            <div className="adm-bar-label" style={{ fontSize: ".875rem" }}>
              <span style={{ fontWeight: 600 }}>
                {t("app.admin.storage.fsTitle")}
              </span>
              <span className="muted">
                {t("app.admin.storage.fsUsage", {
                  used: fmtBytes(summary.filesystemUsedBytes),
                  total: fmtBytes(fsTotal),
                  free: fmtBytes(summary.filesystemAvailableBytes),
                })}
              </span>
            </div>
            <ABar pct={fsPct} />
            {fsPct > 85 ? (
              <div
                className="adm-inline-error"
                style={{ marginTop: ".875rem" }}
              >
                <AlertTriangle size={16} />
                <span>{t("app.admin.storage.fsFull", { pct: fsPct })}</span>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <AEmpty
          icon={<HardDrive size={22} />}
          text={loaderData.summaryError ?? t("app.admin.storage.emptyText")}
          title={t("app.admin.storage.emptyTitle")}
        />
      )}

      <div className="adm-toolbar">
        <div className="adm-seg" role="tablist">
          <button
            aria-selected={tab === "users"}
            className={tab === "users" ? "on" : ""}
            onClick={() => setTab("users")}
            role="tab"
            type="button"
          >
            {t("app.admin.storage.tabUsers")}
          </button>
          <button
            aria-selected={tab === "spaces"}
            className={tab === "spaces" ? "on" : ""}
            onClick={() => setTab("spaces")}
            role="tab"
            type="button"
          >
            {t("app.admin.storage.tabSpaces")}
          </button>
        </div>
      </div>

      <div className="adm-table-wrap">
        {tab === "users" ? (
          <table className="adm-table">
            <thead>
              <tr>
                <th>{t("app.admin.storage.colUser")}</th>
                <th className="num">{t("app.admin.storage.colPhotos")}</th>
                <th className="num">{t("app.admin.storage.colVariants")}</th>
                <th className="num">{t("app.admin.storage.colVolume")}</th>
                <th>{t("app.admin.storage.colShare")}</th>
              </tr>
            </thead>
            <tbody>
              {usersPage.items.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 0 }}>
                    <AEmpty
                      icon={<HardDrive size={22} />}
                      text={t("app.admin.storage.emptyText")}
                      title={t("app.admin.storage.emptyTitle")}
                    />
                  </td>
                </tr>
              ) : (
                usersPage.items.map((row) => (
                  <tr key={row.userId}>
                    <td>
                      <div className="adm-cell-user">
                        <span
                          className="adm-avatar"
                          data-av={avatarIndex(row.userId)}
                        >
                          {initials(row.userName)}
                        </span>
                        <span className="adm-cell-name">{row.userName}</span>
                      </div>
                    </td>
                    <td className="num">{fmtNum(row.photoCount)}</td>
                    <td className="num">{fmtNum(row.variantCount)}</td>
                    <td className="num" style={{ fontWeight: 600 }}>
                      {fmtBytes(row.storageBytesUsed)}
                    </td>
                    <td>
                      <ABar
                        danger={false}
                        mini
                        pct={Math.round(
                          (row.storageBytesUsed / maxUserBytes) * 100,
                        )}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th>{t("app.admin.storage.colSpace")}</th>
                <th className="num">{t("app.admin.storage.colAlbums")}</th>
                <th className="num">{t("app.admin.storage.colPhotos")}</th>
                <th>{t("app.admin.storage.colShare")}</th>
              </tr>
            </thead>
            <tbody>
              {spacesPage.items.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 0 }}>
                    <AEmpty
                      icon={<HardDrive size={22} />}
                      text={t("app.admin.storage.emptyText")}
                      title={t("app.admin.storage.emptyTitle")}
                    />
                  </td>
                </tr>
              ) : (
                spacesPage.items.map((row) => (
                  <tr key={row.spaceId}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{row.spaceName}</div>
                    </td>
                    <td className="num">{fmtNum(row.albumCount)}</td>
                    <td className="num" style={{ fontWeight: 600 }}>
                      {fmtNum(row.photoCount)}
                    </td>
                    <td>
                      <ABar
                        danger={false}
                        mini
                        pct={Math.round(
                          (row.photoCount / maxSpacePhotos) * 100,
                        )}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
        {tab === "users" ? (
          <APager
            onPage={(next) => goToPage("userPage", next - 1)}
            page={usersPage.page + 1}
            pageCount={usersPage.totalPages ?? 1}
            total={usersPage.totalItems ?? usersPage.items.length}
          />
        ) : (
          <APager
            onPage={(next) => goToPage("spacePage", next - 1)}
            page={spacesPage.page + 1}
            pageCount={spacesPage.totalPages ?? 1}
            total={spacesPage.totalItems ?? spacesPage.items.length}
          />
        )}
      </div>
    </>
  );
}
