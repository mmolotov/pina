import { useEffect, useRef, type ReactNode } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { fmtNum } from "~/lib/admin-format";
import { useI18n } from "~/lib/i18n";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type ABadgeTone =
  | "subtle"
  | "primary"
  | "accent"
  | "success"
  | "warn"
  | "danger";

export function ABadge({
  tone = "subtle",
  dot,
  children,
}: {
  tone?: ABadgeTone;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`adm-badge ${tone}`}>
      {dot ? <span className="dot" /> : null}
      {children}
    </span>
  );
}

export function ABar({
  pct,
  danger,
  mini,
}: {
  pct: number;
  danger?: boolean;
  mini?: boolean;
}) {
  const isDanger = danger == null ? pct > 85 : danger;
  const width = Math.min(100, Math.max(0, pct));
  return (
    <div className={`adm-bar${mini ? " mini" : ""}`}>
      <div
        className={`adm-bar-fill${isDanger ? " danger" : ""}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function APager({
  page,
  pageCount,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const { t } = useI18n();
  if (pageCount <= 1 && total <= 10) {
    return null;
  }
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
  return (
    <div className="adm-pager">
      <span>{t("app.admin.total", { count: fmtNum(total) })}</span>
      <div className="adm-pager-btns">
        <button
          aria-label={t("app.admin.prev")}
          className="adm-pager-btn"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          type="button"
        >
          <ChevronLeft size={14} />
        </button>
        {pages.map((p) => (
          <button
            aria-current={p === page ? "page" : undefined}
            className={`adm-pager-btn${p === page ? " on" : ""}`}
            key={p}
            onClick={() => onPage(p)}
            type="button"
          >
            {p}
          </button>
        ))}
        <button
          aria-label={t("app.admin.next")}
          className="adm-pager-btn"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
          type="button"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export function AConfirm({
  tone = "danger",
  icon,
  title,
  children,
  callout,
  confirmLabel,
  confirmIcon,
  busy,
  onCancel,
  onConfirm,
}: {
  tone?: "danger" | "accent";
  icon?: ReactNode;
  title: string;
  children: ReactNode;
  callout?: ReactNode;
  confirmLabel: string;
  confirmIcon?: ReactNode;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const onCancelRef = useRef(onCancel);
  const busyRef = useRef(busy);
  useEffect(() => {
    onCancelRef.current = onCancel;
    busyRef.current = busy;
  });

  useEffect(() => {
    const box = boxRef.current;
    box
      ?.querySelector<HTMLElement>(".adm-confirm-actions button:last-child")
      ?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busyRef.current) {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab" || !box) {
        return;
      }
      const focusables = Array.from(
        box.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusables.length === 0) {
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="dialog-backdrop">
      <div
        aria-label={title}
        aria-modal="true"
        className="dialog-box adm-confirm"
        ref={boxRef}
        role="alertdialog"
      >
        <div className="adm-confirm-head">
          <span className={`adm-confirm-ico ${tone}`}>
            {icon ?? <AlertTriangle size={24} />}
          </span>
          <div>
            <h2 className="adm-confirm-title">{title}</h2>
            <div className="adm-confirm-text">{children}</div>
            {callout ? (
              <div className="adm-confirm-callout">
                <AlertTriangle size={15} />
                <span>{callout}</span>
              </div>
            ) : null}
          </div>
        </div>
        <div className="adm-confirm-actions">
          <button
            className="button-secondary"
            disabled={busy}
            onClick={onCancel}
            type="button"
          >
            {t("common.cancel")}
          </button>
          <button
            className={tone === "danger" ? "button-danger" : "button-primary"}
            disabled={busy}
            onClick={onConfirm}
            style={{ minWidth: "8rem" }}
            type="button"
          >
            {confirmIcon} {busy ? t("app.admin.applying") : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ASkeletonRows({
  cols,
  rows = 6,
}: {
  cols: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: cols }).map((_, colIndex) => (
            <td key={colIndex}>
              <div
                className="adm-skel-row skel"
                style={{
                  width:
                    colIndex === 0
                      ? "70%"
                      : colIndex === cols - 1
                        ? "40%"
                        : "55%",
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function AEmpty({
  icon,
  title,
  text,
  cta,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  cta?: ReactNode;
}) {
  return (
    <div className="adm-empty">
      <div className="adm-empty-ico">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {cta}
    </div>
  );
}

export function ATableError({
  onRetry,
  msg,
}: {
  onRetry: () => void;
  msg?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="adm-empty">
      <div
        className="adm-empty-ico"
        style={{
          background: "var(--color-danger-soft)",
          color: "var(--color-danger-strong)",
        }}
      >
        <AlertTriangle size={24} />
      </div>
      <h3>{t("app.admin.loadErrorTitle")}</h3>
      <p>{msg ?? t("app.admin.loadErrorText")}</p>
      <button
        className="button-primary"
        onClick={onRetry}
        style={{
          marginTop: ".25rem",
          display: "inline-flex",
          alignItems: "center",
          gap: ".375rem",
        }}
        type="button"
      >
        <RefreshCw size={15} /> {t("app.admin.retry")}
      </button>
    </div>
  );
}
