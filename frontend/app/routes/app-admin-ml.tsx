import type { Route } from "./+types/app-admin-ml";
import { useEffect, useRef, useState } from "react";
import { useFetcher, useRevalidator, useSearchParams } from "react-router";
import {
  Activity,
  AlertTriangle,
  Check,
  Cpu,
  ExternalLink,
  Lock,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import {
  ABadge,
  AConfirm,
  AEmpty,
  APager,
  ASkeletonRows,
  ATableError,
  type ABadgeTone,
} from "~/components/admin/ui";
import { fmtDate, fmtNum, formatRelativeCount } from "~/lib/admin-format";
import {
  getAdminMl,
  isBackendUnavailableError,
  listAdminMlJobs,
  reanalyzeAdminMlJob,
  retryAdminMlJob,
  retryAllFailedAdminMl,
} from "~/lib/api";
import { toErrorMessage } from "~/lib/errors";
import { getActiveLocale, translateMessage, useI18n } from "~/lib/i18n";
import { toActionErrorMessage } from "~/lib/route-actions";
import type {
  AdminMlDto,
  AdminMlJobDto,
  AnalysisJobStatus,
  PageResponse,
} from "~/types/api";

const JOB_SIZE = 8;

interface AdminMlLoaderData {
  ml: AdminMlDto | null;
  jobsPage: PageResponse<AdminMlJobDto>;
  statusFilter: string;
  error: string | null;
}

const EMPTY_JOBS: PageResponse<AdminMlJobDto> = {
  items: [],
  page: 0,
  size: JOB_SIZE,
  hasNext: false,
  totalItems: 0,
  totalPages: 0,
};

export async function clientLoader({
  request,
}: Route.ClientLoaderArgs): Promise<AdminMlLoaderData> {
  const url = new URL(request.url);
  const pageParam = Number(url.searchParams.get("page") ?? "0");
  const page = Number.isFinite(pageParam) && pageParam >= 0 ? pageParam : 0;
  const statusFilter = url.searchParams.get("status") ?? "ALL";

  try {
    const [ml, jobsPage] = await Promise.all([
      getAdminMl(),
      listAdminMlJobs({
        page,
        size: JOB_SIZE,
        needsTotal: true,
        status: statusFilter === "ALL" ? null : statusFilter,
      }),
    ]);
    return { ml, jobsPage, statusFilter, error: null };
  } catch (error) {
    if (isBackendUnavailableError(error)) {
      throw error;
    }
    return {
      ml: null,
      jobsPage: EMPTY_JOBS,
      statusFilter,
      error: toErrorMessage(
        error,
        translateMessage(getActiveLocale(), "app.admin.ml.loadFailed"),
      ),
    };
  }
}

type MlActionResult =
  | { ok: true; intent: string; requeued?: number }
  | { ok: false; errorMessage: string };

export async function clientAction({
  request,
}: Route.ClientActionArgs): Promise<MlActionResult> {
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const photoId = String(formData.get("photoId") ?? "");
  try {
    if (intent === "retry") {
      await retryAdminMlJob(photoId);
      return { ok: true, intent };
    }
    if (intent === "reanalyze") {
      await reanalyzeAdminMlJob(photoId);
      return { ok: true, intent };
    }
    if (intent === "retry-failed") {
      const result = await retryAllFailedAdminMl();
      return { ok: true, intent, requeued: result.requeued };
    }
    return {
      ok: false,
      errorMessage: translateMessage(
        getActiveLocale(),
        "app.admin.ml.actionFailed",
      ),
    };
  } catch (error) {
    return {
      ok: false,
      errorMessage: toActionErrorMessage(
        error,
        translateMessage(getActiveLocale(), "app.admin.ml.actionFailed"),
      ),
    };
  }
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "Admin ML | PINA" }];
}

const JOB_TONE: Record<AnalysisJobStatus, ABadgeTone> = {
  PENDING: "primary",
  COMPLETED: "success",
  FAILED: "danger",
};

const STATUS_FILTERS = ["ALL", "PENDING", "FAILED", "COMPLETED"] as const;

const STEP_ORDER: Record<string, number> = {
  image_embedding: 1,
  tagging: 2,
  face_detection: 3,
  face_embedding: 4,
};

export default function AppAdminMlRoute({ loaderData }: Route.ComponentProps) {
  const { t } = useI18n();
  const revalidator = useRevalidator();
  const fetcher = useFetcher<MlActionResult>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmRetryAll, setConfirmRetryAll] = useState(false);
  const [toast, setToast] = useState<{ label: string; ok: boolean } | null>(
    null,
  );
  const pendingToast = useRef<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const [stamp, setStamp] = useState(() => Date.now());

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
    setConfirmRetryAll(false);
  }, [fetcher.state, fetcher.data]);

  const ml = loaderData.ml;
  const status = ml?.status;
  const counts = ml?.counts ?? { pending: 0, completed: 0, failed: 0 };
  const busy = fetcher.state !== "idle";
  const refreshing = revalidator.state === "loading";

  const enabled = status?.enabled ?? false;
  const reachable = status?.reachable ?? false;
  const ready = status?.ready ?? false;
  const operational = enabled && reachable && ready;

  const models = status?.models ?? [];
  const hasLicense = models.some((model) => model.license != null);
  const profile = status?.profile ?? null;
  const inferenceSettings = status?.inferenceSettings ?? [];

  const timeStr = new Intl.DateTimeFormat(getActiveLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(stamp);

  function updateParams(
    updates: Record<string, string | null>,
    options: { resetPage?: boolean } = {},
  ) {
    const nextParams = new URLSearchParams(searchParams);
    if (options.resetPage) {
      nextParams.delete("page");
    }
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value.length === 0 || value === "ALL") {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
    }
    setSearchParams(nextParams, { replace: true });
  }

  function submitJob(intent: "retry" | "reanalyze", photoId: string) {
    pendingToast.current = t(
      intent === "retry"
        ? "app.admin.ml.toastRetried"
        : "app.admin.ml.toastReanalyzed",
    );
    fetcher.submit({ intent, photoId }, { method: "post" });
  }

  function confirmRetryAllFailed() {
    pendingToast.current = t("app.admin.ml.toastRetriedAll", {
      count: formatRelativeCount(counts.failed, {
        one: t("app.admin.ml.jobOne"),
        few: t("app.admin.ml.jobFew"),
        many: t("app.admin.ml.jobMany"),
        other: t("app.admin.ml.jobOther"),
      }),
    });
    fetcher.submit({ intent: "retry-failed" }, { method: "post" });
  }

  const stateBadge = !enabled ? (
    <ABadge dot tone="subtle">
      {t("app.admin.ml.stateDisabled")}
    </ABadge>
  ) : operational ? (
    <ABadge dot tone="success">
      {t("app.admin.ml.stateReady")}
    </ABadge>
  ) : (
    <ABadge dot tone="danger">
      {t("app.admin.ml.stateDown")}
    </ABadge>
  );
  const stateDelta = !enabled
    ? t("app.admin.ml.stateDeltaDisabled")
    : operational
      ? t("app.admin.ml.stateDeltaReady")
      : t("app.admin.ml.stateDeltaDown");

  const jobsPage = loaderData.jobsPage;
  const sortedModels = [...models].sort(
    (a, b) => (STEP_ORDER[a.step] ?? 99) - (STEP_ORDER[b.step] ?? 99),
  );

  return (
    <>
      <div className="adm-section-head">
        <div>
          <h2 className="adm-section-title">{t("app.admin.ml.title")}</h2>
          <p className="adm-section-sub">
            {t("app.admin.ml.sub", { time: timeStr })}
          </p>
        </div>
        <button
          className="button-secondary btn-sm"
          disabled={refreshing}
          onClick={() => {
            revalidator.revalidate();
            setStamp(Date.now());
          }}
          type="button"
        >
          <RefreshCw size={15} /> {t("app.admin.ml.refresh")}
        </button>
      </div>

      {loaderData.error ? (
        <ATableError
          msg={loaderData.error}
          onRetry={() => revalidator.revalidate()}
        />
      ) : (
        <>
          {!operational ? (
            <div className="ml-banner">
              <span className="ml-banner-ico">
                <AlertTriangle size={18} />
              </span>
              <span>
                <b>
                  {!enabled
                    ? t("app.admin.ml.disabledTitle")
                    : t("app.admin.ml.bannerTitle")}
                </b>{" "}
                {!enabled
                  ? t("app.admin.ml.disabledBody")
                  : t("app.admin.ml.bannerBody")}
              </span>
            </div>
          ) : null}

          <div className="adm-kpi-grid">
            <div
              className={`adm-kpi${!operational && enabled ? " danger" : ""}`}
            >
              <span className="adm-kpi-label">
                <Cpu size={14} /> {t("app.admin.ml.kpiState")}
              </span>
              <span className="adm-kpi-value" style={{ fontSize: "1.125rem" }}>
                {stateBadge}
              </span>
              <span className="adm-kpi-delta">{stateDelta}</span>
            </div>
            <div className="adm-kpi">
              <span className="adm-kpi-label">
                <Activity size={14} /> {t("app.admin.ml.kpiVersion")}
              </span>
              <span className="adm-kpi-value">
                {status?.serviceVersion ?? "—"}
              </span>
              <span className="adm-kpi-delta">
                {t("app.admin.ml.kpiVersionDelta")}
              </span>
            </div>
            <div className="adm-kpi">
              <span className="adm-kpi-label">
                <Cpu size={14} /> {t("app.admin.ml.kpiProfile")}
              </span>
              <span className="adm-kpi-value" style={{ fontSize: "1.375rem" }}>
                {status?.activeProfile ?? "—"}
              </span>
              <span className="adm-kpi-delta">
                {profile
                  ? t("app.admin.ml.kpiProfileDelta", {
                      count: profile.executionProviders.length,
                    })
                  : ""}
              </span>
            </div>
            <div className={`adm-kpi${counts.failed > 0 ? " danger" : ""}`}>
              <span className="adm-kpi-label">
                <Activity size={14} /> {t("app.admin.ml.kpiQueue")}
              </span>
              <span className="adm-kpi-value">
                {fmtNum(counts.pending)}{" "}
                <span
                  style={{
                    fontSize: ".875rem",
                    color: "var(--color-text-muted)",
                    fontWeight: 500,
                  }}
                >
                  {t("app.admin.ml.kpiQueueSuffix")}
                </span>
              </span>
              <span
                className={`adm-kpi-delta${counts.failed > 0 ? " warn" : ""}`}
              >
                {t("app.admin.ml.kpiQueueFailed", { count: counts.failed })}
              </span>
            </div>
          </div>

          {models.length > 0 ? (
            <>
              <div className="adm-section-head" style={{ marginTop: ".25rem" }}>
                <div>
                  <h3 className="adm-card-title" style={{ fontSize: "1rem" }}>
                    {t("app.admin.ml.modelsTitle")}
                  </h3>
                  <p className="adm-section-sub">
                    {t("app.admin.ml.modelsSub", {
                      count: fmtNum(models.length),
                    })}
                  </p>
                </div>
              </div>
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>{t("app.admin.ml.colStep")}</th>
                      <th>{t("app.admin.ml.colModel")}</th>
                      <th>{t("app.admin.ml.colAvailability")}</th>
                      {hasLicense ? (
                        <th>{t("app.admin.ml.colLicense")}</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedModels.map((model) => (
                      <tr key={`${model.step}-${model.modelId}`}>
                        <td>
                          <span className="ml-step">
                            <span className="n">
                              {STEP_ORDER[model.step] ?? "•"}
                            </span>
                            {model.step}
                          </span>
                        </td>
                        <td>
                          <div className="adm-cell-name">{model.modelId}</div>
                          <div className="adm-cell-sub">
                            v{model.version} · {model.runtime}
                          </div>
                        </td>
                        <td>
                          <ABadge
                            dot
                            tone={model.available ? "success" : "danger"}
                          >
                            {model.available
                              ? t("app.admin.ml.available")
                              : t("app.admin.ml.missing")}
                          </ABadge>
                        </td>
                        {hasLicense ? (
                          <td>
                            {model.license ? (
                              <div className="ml-license">
                                <div className="ml-license-top">
                                  <span className="ml-license-spdx">
                                    {model.license.spdx}
                                  </span>
                                  <ABadge
                                    tone={
                                      model.license.commercialUse
                                        ? "success"
                                        : "danger"
                                    }
                                  >
                                    {model.license.commercialUse
                                      ? t("app.admin.ml.commercialYes")
                                      : t("app.admin.ml.commercialNo")}
                                  </ABadge>
                                  {!model.license.allowBundling ? (
                                    <ABadge tone="warn">
                                      {t("app.admin.ml.noBundling")}
                                    </ABadge>
                                  ) : null}
                                  {model.license.url ? (
                                    <a
                                      className="ml-license-link"
                                      href={model.license.url}
                                      rel="noreferrer"
                                      target="_blank"
                                    >
                                      {t("app.admin.ml.licenseLink")}{" "}
                                      <ExternalLink size={11} />
                                    </a>
                                  ) : null}
                                </div>
                                {model.license.notes ? (
                                  <div className="ml-license-note">
                                    {model.license.notes}
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {profile ? (
            <>
              <h3
                className="adm-card-title"
                style={{ fontSize: "1rem", marginTop: ".25rem" }}
              >
                {t("app.admin.ml.profileTitle")}
              </h3>
              <div className="adm-card">
                <div className="adm-card-title">
                  <Cpu size={16} /> {profile.name}{" "}
                  <ABadge tone="accent">
                    {t("app.admin.ml.profileActive")}
                  </ABadge>
                </div>
                <div className="adm-prof-meta ml-prof-meta">
                  <div className="ml-prof-meta-cell">
                    <div className="lbl">
                      {t("app.admin.ml.profileMaxParallel")}
                    </div>
                    <div className="v">{profile.maxParallelAnalyses}</div>
                  </div>
                  <div className="ml-prof-meta-cell">
                    <div className="lbl">
                      {t("app.admin.ml.profileResolution")}
                    </div>
                    <div className="v">{profile.analysisMaxResolution}px</div>
                  </div>
                </div>
                <div
                  style={{
                    marginTop: ".75rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: ".5rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div className="ml-ep-chips">
                    {profile.executionProviders.map((provider, index) => (
                      <span className="ml-ep-chip" key={provider}>
                        <span className="ord">{index + 1}.</span>
                        {provider.replace("ExecutionProvider", "")}
                      </span>
                    ))}
                  </div>
                  <span className="ml-lock">
                    <Lock size={12} /> {t("app.admin.ml.profileProviders")}
                  </span>
                </div>
                <div
                  className="ml-license-note"
                  style={{ marginTop: ".75rem" }}
                >
                  {t("app.admin.ml.profileEnvNote")}
                </div>
              </div>
            </>
          ) : null}

          <h3
            className="adm-card-title"
            style={{ fontSize: "1rem", marginTop: ".25rem" }}
          >
            {t("app.admin.ml.queueTitle")}
          </h3>
          <div className="ml-queue-grid">
            <div className="adm-kpi">
              <span className="adm-kpi-label">
                <Activity size={14} /> PENDING
              </span>
              <span className="adm-kpi-value">{fmtNum(counts.pending)}</span>
              <span className="adm-kpi-delta">
                {t("app.admin.ml.queuePendingDelta")}
              </span>
            </div>
            <div className="adm-kpi">
              <span className="adm-kpi-label">
                <Check size={14} /> COMPLETED
              </span>
              <span className="adm-kpi-value">{fmtNum(counts.completed)}</span>
              <span className="adm-kpi-delta up">
                {t("app.admin.ml.queueCompletedDelta")}
              </span>
            </div>
            <div className={`adm-kpi${counts.failed > 0 ? " danger" : ""}`}>
              <span className="adm-kpi-label">
                <AlertTriangle size={14} /> FAILED
              </span>
              <span className="adm-kpi-value">{fmtNum(counts.failed)}</span>
              <span
                className={`adm-kpi-delta${counts.failed > 0 ? " warn" : ""}`}
              >
                {t("app.admin.ml.queueFailedDelta")}
              </span>
            </div>
          </div>

          <div className="adm-toolbar">
            <div className="adm-seg" role="tablist">
              {STATUS_FILTERS.map((filter) => (
                <button
                  aria-selected={loaderData.statusFilter === filter}
                  className={loaderData.statusFilter === filter ? "on" : ""}
                  key={filter}
                  onClick={() =>
                    updateParams({ status: filter }, { resetPage: true })
                  }
                  role="tab"
                  type="button"
                >
                  {filter === "ALL" ? t("app.admin.ml.filterAll") : filter}
                </button>
              ))}
            </div>
            {counts.failed > 0 ? (
              <button
                className="button-danger btn-sm"
                disabled={busy}
                onClick={() => setConfirmRetryAll(true)}
                style={{ marginLeft: "auto" }}
                type="button"
              >
                <RotateCcw size={15} /> {t("app.admin.ml.retryAllFailed")}
              </button>
            ) : null}
          </div>

          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>{t("app.admin.ml.colPhoto")}</th>
                  <th>{t("app.admin.ml.colStatus")}</th>
                  <th className="num">{t("app.admin.ml.colAttempts")}</th>
                  <th>{t("app.admin.ml.colNextAttempt")}</th>
                  <th>{t("app.admin.ml.colLastError")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {refreshing ? (
                  <ASkeletonRows cols={6} rows={5} />
                ) : jobsPage.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 0 }}>
                      <AEmpty
                        icon={<Activity size={22} />}
                        text={t("app.admin.ml.emptyText")}
                        title={t("app.admin.ml.emptyTitle")}
                      />
                    </td>
                  </tr>
                ) : (
                  jobsPage.items.map((job) => (
                    <tr
                      className={job.status === "FAILED" ? "dim" : ""}
                      key={job.photoId}
                    >
                      <td>
                        <div className="adm-cell-user">
                          <span className="ml-jobthumb" />
                          <div style={{ minWidth: 0 }}>
                            <div className="adm-cell-name">
                              {job.photoName ?? "—"}
                            </div>
                            <div className="adm-cell-sub adm-mono">
                              {job.photoId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <ABadge dot tone={JOB_TONE[job.status]}>
                          {job.status}
                        </ABadge>
                      </td>
                      <td className="num">{job.attempts}</td>
                      <td>
                        {job.status === "PENDING" ? (
                          <span className="adm-cell-sub">
                            {fmtDate(job.nextAttemptAt)}
                          </span>
                        ) : (
                          <span
                            className="adm-cell-sub"
                            style={{ opacity: 0.5 }}
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td>
                        {job.lastError ? (
                          <>
                            <button
                              className="ml-err-toggle"
                              onClick={() =>
                                setExpanded(
                                  expanded === job.photoId ? null : job.photoId,
                                )
                              }
                              type="button"
                            >
                              {expanded === job.photoId
                                ? t("app.admin.ml.hideError")
                                : t("app.admin.ml.showError")}
                            </button>
                            {expanded === job.photoId ? (
                              <div className="ml-err-box">{job.lastError}</div>
                            ) : null}
                          </>
                        ) : (
                          <span
                            className="adm-cell-sub"
                            style={{ opacity: 0.5 }}
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="adm-row-actions">
                          {job.status === "FAILED" ? (
                            <button
                              className="adm-text-btn"
                              disabled={busy}
                              onClick={() => submitJob("retry", job.photoId)}
                              type="button"
                            >
                              {t("app.admin.ml.retry")}
                            </button>
                          ) : null}
                          {job.status === "COMPLETED" ? (
                            <button
                              className="adm-text-btn"
                              disabled={busy}
                              onClick={() =>
                                submitJob("reanalyze", job.photoId)
                              }
                              type="button"
                            >
                              {t("app.admin.ml.reanalyze")}
                            </button>
                          ) : null}
                          {job.status === "PENDING" ? (
                            <span
                              className="adm-cell-sub"
                              style={{ opacity: 0.6 }}
                            >
                              {t("app.admin.ml.queued")}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <APager
              onPage={(next) => updateParams({ page: String(next - 1) })}
              page={jobsPage.page + 1}
              pageCount={jobsPage.totalPages ?? 1}
              total={jobsPage.totalItems ?? jobsPage.items.length}
            />
          </div>

          {inferenceSettings.length > 0 ? (
            <>
              <h3
                className="adm-card-title"
                style={{ fontSize: "1rem", marginTop: ".25rem" }}
              >
                {t("app.admin.ml.inferenceTitle")}
              </h3>
              <div className="adm-card">
                <p
                  className="adm-card-sub"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: ".4rem",
                    marginBottom: ".5rem",
                  }}
                >
                  <Lock size={13} /> {t("app.admin.ml.inferenceNote")}
                </p>
                <div className="ml-env-list">
                  {inferenceSettings.map((setting) => (
                    <div className="ml-env-row" key={setting.key}>
                      <span className="ml-env-key">{setting.label}</span>
                      <span className="ml-env-val">{setting.value}</span>
                      <span className="ml-env-meta">
                        <span className="ml-lock">
                          <Lock size={11} /> {setting.key}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </>
      )}

      {confirmRetryAll ? (
        <AConfirm
          busy={busy}
          callout={t("app.admin.ml.retryAllCallout")}
          confirmIcon={<RotateCcw size={15} />}
          confirmLabel={t("app.admin.ml.retryAllBtn")}
          icon={<RotateCcw size={22} />}
          onCancel={() => setConfirmRetryAll(false)}
          onConfirm={confirmRetryAllFailed}
          title={t("app.admin.ml.retryAllTitle")}
          tone="danger"
        >
          {t("app.admin.ml.retryAllBody", {
            count: formatRelativeCount(counts.failed, {
              one: t("app.admin.ml.jobOne"),
              few: t("app.admin.ml.jobFew"),
              many: t("app.admin.ml.jobMany"),
              other: t("app.admin.ml.jobOther"),
            }),
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
