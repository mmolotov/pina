import type { Route } from "./+types/app-spaces";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Layers, LayoutGrid, Plus, Search, Users, X } from "lucide-react";
import { SpaceCard, SpaceTree } from "~/components/space-card";
import { CreateSpaceDialog } from "~/components/space-dialogs";
import { createSpace, listSpaces } from "~/lib/api";
import { getActiveLocale, translateMessage, useI18n } from "~/lib/i18n";
import { toActionErrorMessage } from "~/lib/route-actions";
import type { SpaceDto, SpaceVisibility } from "~/types/api";

export async function clientLoader() {
  return listSpaces();
}

type CreateSpaceActionResult =
  | { ok: true }
  | { ok: false; errorMessage: string };

export async function clientAction({
  request,
}: Route.ClientActionArgs): Promise<CreateSpaceActionResult> {
  const formData = await request.formData();

  try {
    await createSpace({
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      visibility: String(
        formData.get("visibility") ?? "PRIVATE",
      ) as SpaceVisibility,
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      errorMessage: toActionErrorMessage(
        error,
        translateMessage(getActiveLocale(), "app.spaces.createFailed"),
      ),
    };
  }
}

type VisFilter = "ALL" | SpaceVisibility;
type ViewMode = "grid" | "tree";

interface VisibleTree {
  roots: SpaceDto[];
  byParent: Map<string, SpaceDto[]>;
}

function buildVisibleTree(
  spaces: SpaceDto[],
  matches: (space: SpaceDto) => boolean,
): VisibleTree {
  const byId = new Map(spaces.map((space) => [space.id, space]));
  const keep = new Set<string>();
  for (const space of spaces) {
    if (matches(space)) {
      keep.add(space.id);
      let parentId = space.parentId;
      while (parentId) {
        keep.add(parentId);
        parentId = byId.get(parentId)?.parentId ?? null;
      }
    }
  }
  // Keep descendants of any kept node so filtered context is not lost.
  const visibleIds = new Set(keep);
  for (const space of spaces) {
    let parentId = space.parentId;
    while (parentId) {
      if (keep.has(parentId)) {
        visibleIds.add(space.id);
        break;
      }
      parentId = byId.get(parentId)?.parentId ?? null;
    }
  }
  const visible = spaces.filter((space) => visibleIds.has(space.id));
  const present = new Set(visible.map((space) => space.id));
  const byParent = new Map<string, SpaceDto[]>();
  for (const space of visible) {
    if (space.parentId && present.has(space.parentId)) {
      const siblings = byParent.get(space.parentId) ?? [];
      siblings.push(space);
      byParent.set(space.parentId, siblings);
    }
  }
  const roots = visible.filter(
    (space) => !space.parentId || !present.has(space.parentId),
  );
  return { roots, byParent };
}

function SpEmpty({
  kind,
  onCreate,
  onClear,
}: {
  kind: "empty" | "no-match";
  onCreate?: () => void;
  onClear?: () => void;
}) {
  const { t } = useI18n();
  const isNoMatch = kind === "no-match";
  return (
    <div className="sp-empty">
      <div className="sp-empty-ico">
        {isNoMatch ? <Search size={24} /> : <Users size={24} />}
      </div>
      <h3 className="sp-empty-title">
        {isNoMatch
          ? t("app.spaces.noMatchHeading")
          : t("app.spaces.emptyHeading")}
      </h3>
      <p className="sp-empty-text">
        {isNoMatch ? t("app.spaces.noMatchBody") : t("app.spaces.emptyBody")}
      </p>
      {isNoMatch ? (
        <button
          className="button-secondary"
          onClick={onClear}
          style={{ marginTop: ".5rem" }}
          type="button"
        >
          {t("common.clearFilters")}
        </button>
      ) : (
        <button
          className="button-primary"
          onClick={onCreate}
          style={{
            marginTop: ".5rem",
            display: "inline-flex",
            alignItems: "center",
            gap: ".375rem",
          }}
          type="button"
        >
          <Plus size={16} /> {t("app.spaces.createCta")}
        </button>
      )}
    </div>
  );
}

export default function AppSpacesRoute({ loaderData }: Route.ComponentProps) {
  const { t, locale } = useI18n();
  const spaces = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const view: ViewMode = searchParams.get("view") === "tree" ? "tree" : "grid";
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState<VisFilter>("ALL");
  const [createOpen, setCreateOpen] = useState(false);

  const childCountById = useMemo(() => {
    const counts = new Map<string, number>();
    for (const space of spaces) {
      if (space.parentId) {
        counts.set(space.parentId, (counts.get(space.parentId) ?? 0) + 1);
      }
    }
    return counts;
  }, [spaces]);

  const matches = useCallback(
    (space: SpaceDto) => {
      const normalized = query.trim().toLowerCase();
      const visibilityOk =
        visibility === "ALL" || space.visibility === visibility;
      if (!visibilityOk) return false;
      if (!normalized) return true;
      return (
        space.name.toLowerCase().includes(normalized) ||
        (space.description ?? "").toLowerCase().includes(normalized)
      );
    },
    [query, visibility],
  );

  const flat = useMemo(() => spaces.filter(matches), [spaces, matches]);
  const tree = useMemo(
    () => buildVisibleTree(spaces, matches),
    [spaces, matches],
  );

  const stats = useMemo(
    () => ({
      total: spaces.length,
      roots: spaces.filter((space) => !space.parentId).length,
      pub: spaces.filter((space) => space.visibility === "PUBLIC").length,
    }),
    [spaces],
  );

  const dirty = query.trim() !== "" || visibility !== "ALL";
  const clearFilters = () => {
    setQuery("");
    setVisibility("ALL");
  };
  const setView = (next: ViewMode) => {
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous);
        if (next === "grid") {
          params.delete("view");
        } else {
          params.set("view", next);
        }
        return params;
      },
      { replace: true },
    );
  };

  const countFormatter = new Intl.NumberFormat(locale);
  const visTabs: Array<[VisFilter, string]> = [
    ["ALL", t("app.spaces.scopeAll")],
    ["PRIVATE", t("app.spaces.scopePrivate")],
    ["PUBLIC", t("app.spaces.scopePublic")],
  ];

  let body: ReactNode;
  if (spaces.length === 0) {
    body = <SpEmpty kind="empty" onCreate={() => setCreateOpen(true)} />;
  } else if (view === "tree") {
    body =
      tree.roots.length === 0 ? (
        <SpEmpty kind="no-match" onClear={clearFilters} />
      ) : (
        <SpaceTree byParent={tree.byParent} roots={tree.roots} />
      );
  } else {
    body =
      flat.length === 0 ? (
        <SpEmpty kind="no-match" onClear={clearFilters} />
      ) : (
        <div className="sp-grid">
          {flat.map((space) => (
            <SpaceCard
              childCount={childCountById.get(space.id) ?? 0}
              key={space.id}
              space={space}
            />
          ))}
        </div>
      );
  }

  return (
    <div className="sp-page" data-screen-label="Spaces">
      <div className="sp-head">
        <div>
          <p className="eyebrow">{t("app.spaces.headEyebrow")}</p>
          <h1 className="sp-head-title" style={{ marginTop: ".4rem" }}>
            {t("app.spaces.headTitle")}
          </h1>
          <p className="sp-head-lede">{t("app.spaces.headLede")}</p>
        </div>
        <button
          className="button-primary"
          onClick={() => setCreateOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: ".375rem",
            flexShrink: 0,
          }}
          type="button"
        >
          <Plus size={16} /> {t("app.spaces.createCta")}
        </button>
      </div>

      <div className="sp-stats">
        <div className="sp-stat">
          <span className="sp-stat-val">
            {countFormatter.format(stats.total)}
          </span>
          <span className="sp-stat-lbl">{t("app.spaces.statTotal")}</span>
        </div>
        <div className="sp-stat">
          <span className="sp-stat-val">
            {countFormatter.format(stats.roots)}
          </span>
          <span className="sp-stat-lbl">{t("app.spaces.statRoots")}</span>
        </div>
        <div className="sp-stat">
          <span className="sp-stat-val">
            {countFormatter.format(stats.pub)}
          </span>
          <span className="sp-stat-lbl">{t("app.spaces.statPublic")}</span>
        </div>
      </div>

      <div className="sp-toolbar">
        <div className="sp-toolbar-search">
          <span className="ico">
            <Search size={15} />
          </span>
          <input
            aria-label={t("app.spaces.searchPlaceholder")}
            className="field"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("app.spaces.searchPlaceholder")}
            type="search"
            value={query}
          />
        </div>

        <div
          aria-label={t("app.spaces.fieldVisibility")}
          className="scope-tabs"
          role="tablist"
        >
          {visTabs.map(([value, label]) => (
            <button
              aria-selected={visibility === value}
              className={`scope-tab ${visibility === value ? "scope-tab-active" : ""}`}
              key={value}
              onClick={() => setVisibility(value)}
              role="tab"
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        <button
          className="sp-clear"
          disabled={!dirty}
          onClick={clearFilters}
          type="button"
        >
          <X size={13} /> {t("common.clearFilters")}
        </button>

        <div
          aria-label={t("app.spaces.viewToggleAria")}
          className="scope-tabs sp-viewtoggle"
          role="tablist"
        >
          <button
            aria-selected={view === "grid"}
            className={`scope-tab ${view === "grid" ? "scope-tab-active" : ""}`}
            onClick={() => setView("grid")}
            role="tab"
            type="button"
          >
            <LayoutGrid size={14} /> {t("app.spaces.viewGrid")}
          </button>
          <button
            aria-selected={view === "tree"}
            className={`scope-tab ${view === "tree" ? "scope-tab-active" : ""}`}
            onClick={() => setView("tree")}
            role="tab"
            type="button"
          >
            <Layers size={14} /> {t("app.spaces.viewTree")}
          </button>
        </div>
      </div>

      {body}

      {createOpen ? (
        <CreateSpaceDialog onClose={() => setCreateOpen(false)} />
      ) : null}
    </div>
  );
}
