import type { Route } from "./+types/app-trash";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useFetcher, useRevalidator } from "react-router";
import {
  AlertTriangle,
  CheckSquare,
  RefreshCw,
  RotateCcw,
  Trash,
  Trash2,
} from "lucide-react";
import { TrashTile } from "~/components/trash-tile";
import {
  deleteAlbum,
  deletePhoto,
  emptyTrash,
  getTrash,
  purgeTrash,
  restoreTrash,
} from "~/lib/api";
import { formatBytes, formatRelativeCount } from "~/lib/format";
import { getActiveLocale, translateMessage, useI18n } from "~/lib/i18n";
import { toActionErrorMessage } from "~/lib/route-actions";
import type { TrashItemRef, TrashListDto } from "~/types/api";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Trash | PINA" }];
}

const RETENTION_DAYS = 30;
const LEAVE_MS = 230;
const TOAST_MS = 6000;
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type SortKey = "deleted" | "soon" | "name";
type KindKey = "all" | "photo" | "album";

type LoaderResult =
  | { ok: true; trash: TrashListDto }
  | { ok: false; error: string };

export async function clientLoader(): Promise<LoaderResult> {
  try {
    return { ok: true, trash: await getTrash() };
  } catch (error) {
    return {
      ok: false,
      error: toActionErrorMessage(
        error,
        translateMessage(getActiveLocale(), "app.trash.errorBody"),
      ),
    };
  }
}

type ActionResult = { ok: true } | { ok: false; errorMessage: string };

export async function clientAction({
  request,
}: Route.ClientActionArgs): Promise<ActionResult> {
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  let items: TrashItemRef[] = [];
  try {
    items = JSON.parse(
      String(formData.get("payload") ?? "[]"),
    ) as TrashItemRef[];
  } catch {
    items = [];
  }

  try {
    switch (intent) {
      case "restore":
        await restoreTrash(items);
        break;
      case "purge":
        await purgeTrash(items);
        break;
      case "empty":
        await emptyTrash();
        break;
      case "retrash":
        // Undo of a restore: re-issue the soft-delete for each item.
        await Promise.all(
          items.map((item) =>
            item.kind === "PHOTO" ? deletePhoto(item.id) : deleteAlbum(item.id),
          ),
        );
        break;
      default:
        return {
          ok: false,
          errorMessage: translateMessage(
            getActiveLocale(),
            "app.trash.actionFailed",
          ),
        };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      errorMessage: toActionErrorMessage(
        error,
        translateMessage(getActiveLocale(), "app.trash.actionFailed"),
      ),
    };
  }
}

export default function AppTrashRoute({ loaderData }: Route.ComponentProps) {
  if (!loaderData.ok) {
    return <TrashError message={loaderData.error} />;
  }
  return <TrashScreen trash={loaderData.trash} />;
}

function TrashHead({ actions }: { actions?: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="tr-head">
      <div>
        <p className="eyebrow">{t("app.trash.eyebrow")}</p>
        <h1 className="tr-head-title">{t("app.trash.title")}</h1>
        <p className="tr-head-lede">
          {t("app.trash.lede", { days: RETENTION_DAYS })}
        </p>
      </div>
      {actions}
    </div>
  );
}

function TrashError({ message }: { message: string }) {
  const { t } = useI18n();
  const revalidator = useRevalidator();
  return (
    <div className="tr-screen" data-screen-label="Trash">
      <TrashHead />
      <div className="tr-empty">
        <div
          className="tr-empty-ico"
          style={{
            background: "var(--color-danger-soft)",
            color: "var(--color-danger-strong)",
          }}
        >
          <AlertTriangle size={26} />
        </div>
        <h3>{t("app.trash.errorTitle")}</h3>
        <p>{message}</p>
        <button
          className="button-primary"
          onClick={() => revalidator.revalidate()}
          style={{
            marginTop: ".5rem",
            display: "inline-flex",
            alignItems: "center",
            gap: ".375rem",
          }}
          type="button"
        >
          <RefreshCw size={16} /> {t("app.trash.retry")}
        </button>
      </div>
    </div>
  );
}

interface ToastState {
  label: string;
  undo?: () => void;
}

function TrashScreen({ trash }: { trash: TrashListDto }) {
  const { t } = useI18n();
  const fetcher = useFetcher<ActionResult>();
  const locale = getActiveLocale();

  const [sort, setSort] = useState<SortKey>("deleted");
  const [kindFilter, setKindFilter] = useState<KindKey>("all");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [leaving, setLeaving] = useState<Set<string>>(() => new Set());
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [confirm, setConfirm] = useState<{
    ids: string[];
    emptyAll: boolean;
  } | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<number | null>(null);

  // Fresh server data supersedes any optimistic bookkeeping.
  useEffect(() => {
    setRemoved(new Set());
    setLeaving(new Set());
    setSelected((prev) => {
      const valid = new Set(trash.items.map((item) => item.id));
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [trash]);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const visibleItems = useMemo(
    () => trash.items.filter((item) => !removed.has(item.id)),
    [trash.items, removed],
  );

  const filtered = useMemo(() => {
    let list = visibleItems;
    if (kindFilter === "photo") list = list.filter((i) => i.kind === "PHOTO");
    if (kindFilter === "album") list = list.filter((i) => i.kind === "ALBUM");
    const sorted = [...list];
    if (sort === "deleted") {
      sorted.sort(
        (a, b) =>
          b.deletedAt.localeCompare(a.deletedAt) || a.id.localeCompare(b.id),
      );
    } else if (sort === "soon") {
      sorted.sort(
        (a, b) =>
          a.purgeAt.localeCompare(b.purgeAt) || a.id.localeCompare(b.id),
      );
    } else {
      sorted.sort(
        (a, b) =>
          a.name.localeCompare(b.name, locale) || a.id.localeCompare(b.id),
      );
    }
    return sorted;
  }, [visibleItems, kindFilter, sort, locale]);

  const totalItems = visibleItems.length;
  const totalBytes = visibleItems.reduce(
    (sum, item) => sum + item.sizeBytes,
    0,
  );
  const soonest = visibleItems.length
    ? Math.min(...visibleItems.map((item) => item.daysLeft))
    : 0;
  const showEmpty = visibleItems.length === 0;

  const itemForms = {
    one: t("app.trash.itemOne"),
    few: t("app.trash.itemFew"),
    many: t("app.trash.itemMany"),
    other: t("app.trash.itemOther"),
  };
  const dayForms = {
    one: t("app.trash.dayOne"),
    few: t("app.trash.dayFew"),
    many: t("app.trash.dayMany"),
    other: t("app.trash.dayOther"),
  };

  const refsFor = (ids: string[]): TrashItemRef[] =>
    ids
      .map((id) => trash.items.find((item) => item.id === id))
      .filter((item): item is (typeof trash.items)[number] => item != null)
      .map((item) => ({ kind: item.kind, id: item.id }));

  const submitIntent = (intent: string, refs: TrashItemRef[]) => {
    fetcher.submit(
      { intent, payload: JSON.stringify(refs) },
      { method: "post" },
    );
  };

  const showToast = (label: string, undo?: () => void) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ label, undo });
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS);
  };

  // Animate the tiles out, then drop them from view and run the mutation.
  const removeWithAnim = (ids: string[], onCommit: () => void) => {
    setLeaving((prev) => new Set([...prev, ...ids]));
    window.setTimeout(() => {
      setLeaving((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setRemoved((prev) => new Set([...prev, ...ids]));
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      onCommit();
    }, LEAVE_MS);
  };

  const restore = (ids: string[]) => {
    if (ids.length === 0) return;
    const refs = refsFor(ids);
    if (ids.length > 1) setSelecting(false);
    removeWithAnim(ids, () => {
      submitIntent("restore", refs);
      showToast(t("app.trash.toastRestored", { count: ids.length }), () => {
        submitIntent("retrash", refs);
        setToast(null);
      });
    });
  };

  const doPurge = () => {
    if (!confirm) return;
    const { ids, emptyAll } = confirm;
    const refs = refsFor(ids);
    const count = ids.length;
    setConfirm(null);
    setSelecting(false);
    removeWithAnim(ids, () => {
      submitIntent(emptyAll ? "empty" : "purge", refs);
      showToast(t("app.trash.toastPurged", { count }));
    });
  };

  const askPurge = (ids: string[]) => {
    if (ids.length === 0) return;
    setConfirm({ ids, emptyAll: false });
  };
  const askEmptyAll = () =>
    setConfirm({ ids: visibleItems.map((item) => item.id), emptyAll: true });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const exitSelect = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const selectedIds = [...selected];

  return (
    <div className="tr-screen" data-screen-label="Trash">
      <TrashHead
        actions={
          showEmpty ? undefined : (
            <div className="tr-head-actions">
              <button
                aria-pressed={selecting}
                className="button-secondary btn-sm"
                onClick={() => (selecting ? exitSelect() : setSelecting(true))}
                type="button"
              >
                <CheckSquare size={15} />{" "}
                {t(selecting ? "app.trash.selectDone" : "app.trash.select")}
              </button>
              <button
                className="button-danger btn-sm"
                onClick={askEmptyAll}
                type="button"
              >
                <Trash2 size={15} /> {t("app.trash.emptyTrash")}
              </button>
            </div>
          )
        }
      />

      {showEmpty ? null : (
        <div className="tr-info">
          <span className="tr-info-ico">
            <Trash size={20} />
          </span>
          <div className="tr-info-stats">
            <span>
              <strong>{formatRelativeCount(totalItems, itemForms)}</strong>
            </span>
            <span className="tr-info-sep" />
            <span>
              {t("app.trash.infoOccupy", { size: formatBytes(totalBytes) })}
            </span>
            <span className="tr-info-sep" />
            <span>
              {t("app.trash.infoSoonLabel")}{" "}
              <span className={soonest <= 3 ? "tr-info-soon" : ""}>
                {t("app.trash.infoInDays", {
                  days: formatRelativeCount(soonest, dayForms),
                })}
              </span>
            </span>
          </div>
          <span className="tr-info-note">{t("app.trash.infoNote")}</span>
        </div>
      )}

      {showEmpty ? null : (
        <div className="tr-controls">
          <div
            aria-label={t("app.trash.filterAria")}
            className="tr-seg"
            role="tablist"
          >
            {(
              [
                { k: "all", label: t("app.trash.filterAll") },
                { k: "photo", label: t("app.trash.filterPhotos") },
                { k: "album", label: t("app.trash.filterAlbums") },
              ] as const
            ).map(({ k, label }) => (
              <button
                aria-selected={kindFilter === k}
                className={kindFilter === k ? "on" : ""}
                key={k}
                onClick={() => setKindFilter(k)}
                role="tab"
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <select
            aria-label={t("app.trash.sortAria")}
            className="tr-select"
            onChange={(event) => setSort(event.target.value as SortKey)}
            value={sort}
          >
            <option value="deleted">{t("app.trash.sortRecent")}</option>
            <option value="soon">{t("app.trash.sortSoon")}</option>
            <option value="name">{t("app.trash.sortName")}</option>
          </select>
          <span className="tr-controls-count">
            {t("app.trash.countOfTotal", {
              shown: filtered.length,
              total: totalItems,
            })}
          </span>
        </div>
      )}

      {showEmpty ? (
        <div className="tr-empty">
          <div className="tr-empty-ico">
            <Trash size={28} />
          </div>
          <h3>{t("app.trash.emptyTitle")}</h3>
          <p>{t("app.trash.emptyBody", { days: RETENTION_DAYS })}</p>
          <Link
            className="button-primary"
            style={{ marginTop: ".5rem" }}
            to="/app/library"
          >
            {t("app.trash.backToLibrary")}
          </Link>
        </div>
      ) : (
        <div className="tr-grid">
          {filtered.map((item) => (
            <TrashTile
              item={item}
              key={item.id}
              leaving={leaving.has(item.id)}
              onPurge={(id) => askPurge([id])}
              onRestore={(id) => restore([id])}
              onToggle={toggle}
              selected={selected.has(item.id)}
              selecting={selecting}
            />
          ))}
        </div>
      )}

      {selecting && selectedIds.length > 0 && !toast ? (
        <div
          aria-label={t("app.trash.bulkAria")}
          className="tr-bulk"
          role="region"
        >
          <span className="tr-bulk-count">
            {t("app.trash.bulkSelected", { count: selectedIds.length })}
          </span>
          <button
            className="tr-bulk-clear"
            onClick={() => setSelected(new Set())}
            type="button"
          >
            {t("app.trash.bulkClear")}
          </button>
          <span className="tr-bulk-divider" />
          <button
            className="button-primary btn-sm"
            onClick={() => restore(selectedIds)}
            type="button"
          >
            <RotateCcw size={15} /> {t("app.trash.bulkRestore")}
          </button>
          <button
            className="button-danger btn-sm"
            onClick={() => askPurge(selectedIds)}
            type="button"
          >
            <Trash2 size={15} /> {t("app.trash.bulkDelete")}
          </button>
        </div>
      ) : null}

      {toast ? (
        <div className="tr-toast" role="status">
          <span>{toast.label}</span>
          {toast.undo ? (
            <button
              className="tr-toast-undo"
              onClick={toast.undo}
              type="button"
            >
              {t("app.trash.undo")}
            </button>
          ) : null}
        </div>
      ) : null}

      {confirm ? (
        <ConfirmPurge
          count={confirm.ids.length}
          emptyAll={confirm.emptyAll}
          onCancel={() => setConfirm(null)}
          onConfirm={doPurge}
        />
      ) : null}
    </div>
  );
}

function ConfirmPurge({
  count,
  emptyAll,
  onCancel,
  onConfirm,
}: {
  count: number;
  emptyAll: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  });

  useEffect(() => {
    const box = boxRef.current;
    box?.querySelector<HTMLElement>(".button-danger")?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab" || !box) return;
      const focusables = Array.from(
        box.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusables.length === 0) return;
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

  const countText = formatRelativeCount(count, {
    one: t("app.trash.itemOne"),
    few: t("app.trash.itemFew"),
    many: t("app.trash.itemMany"),
    other: t("app.trash.itemOther"),
  });

  return (
    <div className="dialog-backdrop">
      <div
        aria-labelledby="tr-confirm-title"
        aria-modal="true"
        className="dialog-box tr-confirm"
        ref={boxRef}
        role="alertdialog"
      >
        <div className="tr-confirm-head">
          <span className="tr-confirm-ico">
            <AlertTriangle size={24} />
          </span>
          <div>
            <h2 className="tr-confirm-title" id="tr-confirm-title">
              {t(
                emptyAll
                  ? "app.trash.confirmEmptyTitle"
                  : "app.trash.confirmPurgeTitle",
              )}
            </h2>
            <p className="tr-confirm-text">
              {t(
                emptyAll
                  ? "app.trash.confirmEmptyBody"
                  : "app.trash.confirmPurgeBody",
                { count: countText },
              )}
            </p>
          </div>
        </div>
        <div className="tr-confirm-actions">
          <button className="button-secondary" onClick={onCancel} type="button">
            {t("common.cancel")}
          </button>
          <button className="button-danger" onClick={onConfirm} type="button">
            <Trash2 size={15} />{" "}
            {t(emptyAll ? "app.trash.emptyTrash" : "app.trash.bulkDelete")}
          </button>
        </div>
      </div>
    </div>
  );
}
