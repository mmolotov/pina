import type { Route } from "./+types/app-admin-index";
import { Link } from "react-router";
import {
  Activity,
  ChevronRight,
  Database,
  HardDrive,
  ImageIcon,
  Layers,
  Link2,
  Server,
  Settings,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ABadge, ABar, AEmpty } from "~/components/admin/ui";
import { fmtBytes, fmtNum } from "~/lib/admin-format";
import { getAdminOverview, isBackendUnavailableError } from "~/lib/api";
import { toErrorMessage } from "~/lib/errors";
import { getActiveLocale, translateMessage, useI18n } from "~/lib/i18n";
import type { AdminOverviewDto } from "~/types/api";

interface AdminOverviewLoaderData {
  overview: AdminOverviewDto | null;
  error: string | null;
}

export async function clientLoader({
  request: _request,
}: Route.ClientLoaderArgs): Promise<AdminOverviewLoaderData> {
  try {
    return { overview: await getAdminOverview(), error: null };
  } catch (error) {
    if (isBackendUnavailableError(error)) {
      throw error;
    }
    return {
      overview: null,
      error: toErrorMessage(
        error,
        translateMessage(getActiveLocale(), "app.admin.overview.loadFailed"),
      ),
    };
  }
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "Admin Overview | PINA" }];
}

interface Kpi {
  label: string;
  value: string;
  delta: string;
  Icon: LucideIcon;
  danger?: boolean;
  cls?: "up" | "warn";
}

export default function AppAdminIndexRoute({
  loaderData,
}: Route.ComponentProps) {
  const { t } = useI18n();
  const overview = loaderData.overview;

  if (!overview) {
    return (
      <>
        <div className="adm-section-head">
          <div>
            <h2 className="adm-section-title">
              {t("app.admin.overview.title")}
            </h2>
          </div>
        </div>
        <AEmpty
          icon={<Activity size={22} />}
          text={loaderData.error ?? t("app.admin.loadErrorText")}
          title={t("app.admin.loadErrorTitle")}
        />
      </>
    );
  }

  const fsTotal =
    overview.filesystemUsedBytes + overview.filesystemAvailableBytes;
  const fsPct =
    fsTotal > 0
      ? Math.round((overview.filesystemUsedBytes / fsTotal) * 100)
      : 0;
  const heapPct =
    overview.jvmHeapMaxBytes > 0
      ? Math.round((overview.jvmHeapUsedBytes / overview.jvmHeapMaxBytes) * 100)
      : 0;
  const isUp = overview.status === "UP";

  const kpis: Kpi[] = [
    {
      label: t("app.admin.overview.kpiUsers"),
      value: fmtNum(overview.totalUsers),
      delta: "",
      Icon: Users,
    },
    {
      label: t("app.admin.overview.kpiActive"),
      value: fmtNum(overview.activeUsers),
      delta: t("app.admin.overview.deltaDisabled", {
        count: fmtNum(overview.totalUsers - overview.activeUsers),
      }),
      Icon: Activity,
    },
    {
      label: t("app.admin.overview.kpiAdmins"),
      value: fmtNum(overview.adminUsers),
      delta: t("app.admin.overview.deltaAdmins"),
      Icon: Shield,
    },
    {
      label: t("app.admin.overview.kpiSpaces"),
      value: fmtNum(overview.totalSpaces),
      delta: t("app.admin.overview.deltaSpaces"),
      Icon: Layers,
    },
    {
      label: t("app.admin.overview.kpiPhotos"),
      value: fmtNum(overview.totalPhotos),
      delta: t("app.admin.overview.deltaVariants", {
        count: fmtNum(overview.totalVariants),
      }),
      Icon: ImageIcon,
    },
    {
      label: t("app.admin.overview.kpiStorage"),
      value: fmtBytes(overview.totalStorageBytes),
      delta: t("app.admin.overview.deltaLogical"),
      Icon: Database,
    },
    {
      label: t("app.admin.overview.kpiFree"),
      value: fmtBytes(overview.filesystemAvailableBytes),
      delta:
        fsPct > 85
          ? t("app.admin.overview.deltaDiskFull", { pct: fsPct })
          : t("app.admin.overview.deltaUsed", { pct: fsPct }),
      Icon: HardDrive,
      danger: fsPct > 85,
      cls: fsPct > 85 ? "warn" : undefined,
    },
    {
      label: t("app.admin.overview.kpiVersion"),
      value: overview.version,
      delta: isUp
        ? t("app.admin.overview.statusUp")
        : t("app.admin.overview.statusDown"),
      Icon: Server,
      cls: isUp ? "up" : "warn",
    },
  ];

  const quickActions: {
    to: string;
    label: string;
    sub: string;
    Icon: LucideIcon;
  }[] = [
    {
      to: "/app/admin/users",
      label: t("app.admin.overview.quickUsers"),
      sub: t("app.admin.overview.quickUsersSub"),
      Icon: Users,
    },
    {
      to: "/app/admin/invites",
      label: t("app.admin.overview.quickInvites"),
      sub: t("app.admin.overview.quickInvitesSub", {
        count: fmtNum(overview.activeInvites),
      }),
      Icon: Link2,
    },
    {
      to: "/app/admin/settings",
      label: t("app.admin.overview.quickSettings"),
      sub: t("app.admin.overview.quickSettingsSub"),
      Icon: Settings,
    },
  ];

  return (
    <>
      <div className="adm-section-head">
        <div>
          <h2 className="adm-section-title">{t("app.admin.overview.title")}</h2>
          <p className="adm-section-sub">{t("app.admin.overview.sub")}</p>
        </div>
      </div>

      <div className="adm-kpi-grid">
        {kpis.map((kpi) => (
          <div
            className={`adm-kpi${kpi.danger ? " danger" : ""}`}
            key={kpi.label}
          >
            <span className="adm-kpi-label">
              <kpi.Icon size={14} /> {kpi.label}
            </span>
            <span className="adm-kpi-value">{kpi.value}</span>
            <span className={`adm-kpi-delta ${kpi.cls ?? ""}`}>
              {kpi.delta}
            </span>
          </div>
        ))}
      </div>

      <div className="adm-overview-cols">
        <div className="adm-card">
          <div className="adm-card-title">
            <Activity size={16} /> {t("app.admin.overview.systemTitle")}
          </div>
          <p className="adm-card-sub">{t("app.admin.overview.systemSub")}</p>
          <div className="adm-kv" style={{ marginTop: "1rem" }}>
            <div className="adm-kv-row">
              <span>{t("app.admin.overview.database")}</span>
              <span>
                <ABadge
                  dot
                  tone={overview.databaseConnected ? "success" : "danger"}
                >
                  {t(
                    overview.databaseConnected
                      ? "app.admin.health.connected"
                      : "app.admin.health.offline",
                  )}
                </ABadge>
              </span>
            </div>
            <div className="adm-kv-row">
              <span>{t("app.admin.overview.storageProvider")}</span>
              <span>{overview.storageProvider}</span>
            </div>
            <div style={{ marginTop: ".25rem" }}>
              <div className="adm-bar-label">
                <span>{t("app.admin.overview.jvmHeap")}</span>
                <span className="muted">
                  {fmtBytes(overview.jvmHeapUsedBytes)} /{" "}
                  {fmtBytes(overview.jvmHeapMaxBytes)}
                </span>
              </div>
              <ABar pct={heapPct} />
            </div>
            <div style={{ marginTop: ".25rem" }}>
              <div className="adm-bar-label">
                <span>{t("app.admin.overview.disk")}</span>
                <span className="muted">
                  {fmtBytes(overview.filesystemUsedBytes)} / {fmtBytes(fsTotal)}
                </span>
              </div>
              <ABar pct={fsPct} />
            </div>
          </div>
        </div>

        <div className="adm-card">
          <div className="adm-card-title">
            <Settings size={16} /> {t("app.admin.overview.quickTitle")}
          </div>
          <p className="adm-card-sub">{t("app.admin.overview.quickSub")}</p>
          <div className="adm-qa" style={{ marginTop: "1rem" }}>
            {quickActions.map((action) => (
              <Link className="adm-qa-btn" key={action.to} to={action.to}>
                <span className="adm-qa-ico">
                  <action.Icon size={16} />
                </span>
                <span className="adm-qa-txt">
                  <b>{action.label}</b>
                  <span>{action.sub}</span>
                </span>
                <ChevronRight size={16} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
