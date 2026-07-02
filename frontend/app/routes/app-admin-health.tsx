import type { Route } from "./+types/app-admin-health";
import { useState } from "react";
import { useRevalidator } from "react-router";
import { Activity, Database, HardDrive, RefreshCw, Server } from "lucide-react";
import { ABadge, ABar, AEmpty } from "~/components/admin/ui";
import { fmtBytes } from "~/lib/admin-format";
import { getAdminHealth, isBackendUnavailableError } from "~/lib/api";
import { toErrorMessage } from "~/lib/errors";
import { getActiveLocale, translateMessage, useI18n } from "~/lib/i18n";
import type { AdminHealthDto } from "~/types/api";

interface AdminHealthLoaderData {
  health: AdminHealthDto | null;
  error: string | null;
}

export async function clientLoader({
  request: _request,
}: Route.ClientLoaderArgs): Promise<AdminHealthLoaderData> {
  try {
    return { health: await getAdminHealth(), error: null };
  } catch (error) {
    if (isBackendUnavailableError(error)) {
      throw error;
    }
    return {
      health: null,
      error: toErrorMessage(
        error,
        translateMessage(getActiveLocale(), "app.admin.health.loadFailed"),
      ),
    };
  }
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "Admin Health | PINA" }];
}

export default function AppAdminHealthRoute({
  loaderData,
}: Route.ComponentProps) {
  const { t } = useI18n();
  const revalidator = useRevalidator();
  const [stamp, setStamp] = useState(() => Date.now());
  const refreshing = revalidator.state === "loading";
  const health = loaderData.health;

  const timeStr = new Intl.DateTimeFormat(getActiveLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(stamp);

  function refresh() {
    revalidator.revalidate();
    setStamp(Date.now());
  }

  if (!health) {
    return (
      <>
        <div className="adm-section-head">
          <div>
            <h2 className="adm-section-title">{t("app.admin.health.title")}</h2>
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

  const heapPct = Math.round(
    (health.jvm.heapUsedBytes / health.jvm.heapMaxBytes) * 100,
  );
  const stoTotal = health.storage.usedBytes + health.storage.availableBytes;
  const stoPct =
    stoTotal > 0 ? Math.round((health.storage.usedBytes / stoTotal) * 100) : 0;
  const dbConnected = health.database.connected;

  return (
    <>
      <div className="adm-section-head">
        <div>
          <h2 className="adm-section-title">{t("app.admin.health.title")}</h2>
          <p className="adm-section-sub">
            {t("app.admin.health.updatedAt", { time: timeStr })}
          </p>
        </div>
        <button
          className="button-secondary btn-sm"
          disabled={refreshing}
          onClick={refresh}
          type="button"
        >
          <RefreshCw size={15} /> {t("app.admin.health.refresh")}
        </button>
      </div>

      <div
        className="adm-card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <span
          className={`adm-stat-ico ${health.status === "UP" ? "ok" : "danger"}`}
          style={{ width: "3rem", height: "3rem" }}
        >
          <Activity size={22} />
        </span>
        <div style={{ flex: 1, minWidth: "12rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
            <span style={{ fontSize: "1.125rem", fontWeight: 700 }}>
              {t("app.admin.health.instance")}
            </span>
            <ABadge dot tone={health.status === "UP" ? "success" : "danger"}>
              {health.status}
            </ABadge>
          </div>
          <div className="adm-cell-sub" style={{ marginTop: ".2rem" }}>
            PINA {health.version} ·{" "}
            {t("app.admin.health.cpu", {
              count: health.jvm.availableProcessors,
            })}
          </div>
        </div>
      </div>

      <div className="adm-health-grid">
        <div className="adm-card">
          <div
            style={{ display: "flex", alignItems: "center", gap: ".625rem" }}
          >
            <span className={`adm-stat-ico ${dbConnected ? "ok" : "danger"}`}>
              <Database size={18} />
            </span>
            <div>
              <div className="adm-card-title" style={{ fontSize: ".875rem" }}>
                {t("app.admin.health.dbTitle")}
              </div>
              <div className="adm-card-sub">
                {health.database.version ?? "—"}
              </div>
            </div>
          </div>
          <div className="adm-kv" style={{ marginTop: "1rem" }}>
            <div className="adm-kv-row">
              <span>{t("app.admin.health.dbConnection")}</span>
              <span>
                <ABadge dot tone={dbConnected ? "success" : "danger"}>
                  {t(
                    dbConnected
                      ? "app.admin.health.connected"
                      : "app.admin.health.offline",
                  )}
                </ABadge>
              </span>
            </div>
            <div className="adm-kv-row">
              <span>{t("app.admin.health.dbVersion")}</span>
              <span>
                {health.database.version
                  ? health.database.version.replace("PostgreSQL ", "PG ")
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="adm-card">
          <div
            style={{ display: "flex", alignItems: "center", gap: ".625rem" }}
          >
            <span className={`adm-stat-ico ${stoPct > 85 ? "danger" : "ok"}`}>
              <HardDrive size={18} />
            </span>
            <div>
              <div className="adm-card-title" style={{ fontSize: ".875rem" }}>
                {t("app.admin.health.storageTitle")}
              </div>
              <div className="adm-card-sub">{health.storage.provider}</div>
            </div>
          </div>
          <div style={{ marginTop: "1rem" }}>
            <div className="adm-bar-label">
              <span>{t("app.admin.health.storageUsed")}</span>
              <span className="muted">{stoPct}%</span>
            </div>
            <ABar pct={stoPct} />
            <div className="adm-kv" style={{ marginTop: ".75rem" }}>
              <div className="adm-kv-row">
                <span>{t("app.admin.health.storageUsed")}</span>
                <span>{fmtBytes(health.storage.usedBytes)}</span>
              </div>
              <div className="adm-kv-row">
                <span>{t("app.admin.health.storageAvailable")}</span>
                <span>{fmtBytes(health.storage.availableBytes)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="adm-card">
          <div
            style={{ display: "flex", alignItems: "center", gap: ".625rem" }}
          >
            <span className={`adm-stat-ico ${heapPct > 90 ? "danger" : "ok"}`}>
              <Server size={18} />
            </span>
            <div>
              <div className="adm-card-title" style={{ fontSize: ".875rem" }}>
                {t("app.admin.health.jvmTitle")}
              </div>
              <div className="adm-card-sub">
                {t("app.admin.health.jvmProcessors", {
                  count: health.jvm.availableProcessors,
                })}
              </div>
            </div>
          </div>
          <div style={{ marginTop: "1rem" }}>
            <div className="adm-bar-label">
              <span>{t("app.admin.health.jvmHeap")}</span>
              <span className="muted">{heapPct}%</span>
            </div>
            <ABar danger={heapPct > 90} pct={heapPct} />
            <div className="adm-kv" style={{ marginTop: ".75rem" }}>
              <div className="adm-kv-row">
                <span>{t("app.admin.health.jvmHeapUsed")}</span>
                <span>
                  {fmtBytes(health.jvm.heapUsedBytes)} /{" "}
                  {fmtBytes(health.jvm.heapMaxBytes)}
                </span>
              </div>
              <div className="adm-kv-row">
                <span>{t("app.admin.health.jvmNonHeap")}</span>
                <span>{fmtBytes(health.jvm.nonHeapUsedBytes)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
