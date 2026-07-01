import { useState } from "react";
import { Link } from "react-router";
import {
  ChevronRight,
  Globe,
  Image as ImageIcon,
  Layers,
  Link2,
  Lock,
  Users,
} from "lucide-react";
import {
  albumPhotoSwatchClass,
  getAlbumPaletteIndex,
} from "~/lib/album-view-prefs";
import { formatDateRange, formatRelativeCount } from "~/lib/format";
import { useI18n, type MessageKey } from "~/lib/i18n";
import type { SpaceDto, SpaceRole, SpaceVisibility } from "~/types/api";

export function spaceInitials(name: string): string {
  const words = name
    .replace(/[«»"']/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function roleLabelKey(role: SpaceRole): MessageKey {
  switch (role) {
    case "OWNER":
      return "app.spaces.roleOwner";
    case "ADMIN":
      return "app.spaces.roleAdmin";
    case "MEMBER":
      return "app.spaces.roleMember";
    case "VIEWER":
      return "app.spaces.roleViewer";
  }
}

function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function VisBadge({
  visibility,
  glass,
}: {
  visibility: SpaceVisibility;
  glass?: boolean;
}) {
  const { t } = useI18n();
  const isPublic = visibility === "PUBLIC";
  const cls = glass
    ? "badge badge-glass"
    : `badge ${isPublic ? "badge-primary" : "badge-neutral"}`;
  return (
    <span className={cls}>
      {isPublic ? <Globe size={11} /> : <Lock size={11} />}
      {isPublic ? t("app.spaces.badgePublic") : t("app.spaces.badgePrivate")}
    </span>
  );
}

export function RoleBadge({
  role,
  glass,
}: {
  role: SpaceRole;
  glass?: boolean;
}) {
  const { t } = useI18n();
  const tokenCls =
    role === "OWNER"
      ? "badge-accent"
      : role === "ADMIN"
        ? "badge-violet"
        : role === "MEMBER"
          ? "badge-primary"
          : "badge-neutral";
  const cls = glass ? "badge badge-glass" : `badge ${tokenCls}`;
  return (
    <span className={`${cls} role-${role.toLowerCase()}`}>
      <span className="badge-dot" />
      {t(roleLabelKey(role))}
    </span>
  );
}

interface SpaceCardProps {
  space: SpaceDto;
  childCount: number;
}

export function SpaceCard({ space, childCount }: SpaceCardProps) {
  const { t, locale } = useI18n();
  const paletteIdx = getAlbumPaletteIndex(space.id);
  const memberDots = Math.min(4, space.memberCount);
  const roleLabel = space.myRole ? t(roleLabelKey(space.myRole)) : "";

  return (
    <Link
      aria-label={t("app.spaces.cardAria", {
        name: space.name,
        role: roleLabel,
      })}
      className={`sp-card album-palette-${paletteIdx}`}
      to={`/app/spaces/${space.id}`}
    >
      <div className={`sp-cover album-palette-${paletteIdx}`}>
        <div aria-hidden className="sp-cover-mosaic">
          {[0, 1, 2, 3].map((i) => (
            <i className={albumPhotoSwatchClass(paletteIdx + i)} key={i} />
          ))}
        </div>
        <div className="sp-cover-badges">
          <VisBadge glass visibility={space.visibility} />
          {space.myRole ? <RoleBadge glass role={space.myRole} /> : null}
        </div>
        {memberDots > 0 ? (
          <div aria-hidden className="sp-members-stack">
            {Array.from({ length: memberDots }).map((_, i) => (
              <i
                className={albumPhotoSwatchClass(paletteIdx + i + 1)}
                key={i}
              />
            ))}
            {space.memberCount > 4 ? (
              <i className="sp-members-more">
                +{formatCount(space.memberCount - 4, locale)}
              </i>
            ) : null}
          </div>
        ) : null}
        <div className={`sp-avatar album-palette-${paletteIdx}`}>
          {spaceInitials(space.name)}
        </div>
      </div>

      <div className="sp-body">
        <div className="sp-name-row">
          <h3 className="sp-name">{space.name}</h3>
        </div>
        <p className="sp-desc">
          {space.description ? (
            space.description
          ) : (
            <span className="nil">{t("app.spaces.cardNoDescription")}</span>
          )}
        </p>

        <div className="sp-meta">
          <div className="sp-meta-item">
            <span className="sp-meta-val">
              <Users size={14} />
              {formatCount(space.memberCount, locale)}
            </span>
            <span className="sp-meta-lbl">{t("app.spaces.metaMembers")}</span>
          </div>
          <div className="sp-meta-item">
            <span className="sp-meta-val">
              <ImageIcon size={14} />
              {formatCount(space.albumCount, locale)}
            </span>
            <span className="sp-meta-lbl">{t("app.spaces.metaAlbums")}</span>
          </div>
          <div className="sp-meta-item">
            <span className="sp-meta-val">
              <Layers size={14} />
              {formatCount(childCount, locale)}
            </span>
            <span className="sp-meta-lbl">{t("app.spaces.metaSub")}</span>
          </div>
        </div>

        <div className="sp-foot">
          {space.depth === 0 ? (
            <span className="sp-chip">{t("app.spaces.chipRoot")}</span>
          ) : (
            <span className="sp-chip">
              <Layers size={11} />
              {t("app.spaces.chipLevel", { count: space.depth })}
            </span>
          )}
          <span className="sp-foot-date">
            {t("app.spaces.updatedPrefix")}{" "}
            {formatDateRange(space.updatedAt, space.updatedAt, locale)}
          </span>
        </div>
      </div>
    </Link>
  );
}

interface TreeNodeProps {
  space: SpaceDto;
  byParent: Map<string, SpaceDto[]>;
  isChild: boolean;
}

function TreeNode({ space, byParent, isChild }: TreeNodeProps) {
  const { t, locale } = useI18n();
  const children = byParent.get(space.id) ?? [];
  const hasKids = children.length > 0;
  const [open, setOpen] = useState(space.depth === 0);
  const paletteIdx = getAlbumPaletteIndex(space.id);

  const subCountLabel = formatRelativeCount(children.length, {
    one: t("app.spaceDetail.subUnitOne"),
    few: t("app.spaceDetail.subUnitFew"),
    many: t("app.spaceDetail.subUnitMany"),
    other: t("app.spaceDetail.subUnitOther"),
  });
  const updatedLabel = `${t("app.spaces.updatedPrefix")} ${formatDateRange(
    space.updatedAt,
    space.updatedAt,
    locale,
  )}`;

  return (
    <div className={`sp-node ${isChild ? "sp-node-child" : ""}`}>
      <div className="sp-row">
        <button
          aria-expanded={open}
          aria-label={open ? t("app.spaces.collapse") : t("app.spaces.expand")}
          className={`sp-twist ${hasKids ? "" : "leaf"} ${open ? "open" : ""}`}
          onClick={() => setOpen((value) => !value)}
          tabIndex={hasKids ? 0 : -1}
          type="button"
        >
          <ChevronRight size={16} />
        </button>
        <Link
          aria-label={t("app.spaces.cardAria", {
            name: space.name,
            role: space.myRole ? t(roleLabelKey(space.myRole)) : "",
          })}
          className="sp-row-link"
          to={`/app/spaces/${space.id}`}
        >
          <div className={`sp-row-avatar album-palette-${paletteIdx}`}>
            {spaceInitials(space.name)}
          </div>
          <div className="sp-row-main">
            <div className="sp-row-top">
              <span className="sp-row-name">{space.name}</span>
              <VisBadge visibility={space.visibility} />
              {space.myRole ? <RoleBadge role={space.myRole} /> : null}
              {isChild ? (
                <span
                  className={`sp-chip ${space.inheritMembers ? "inherit" : ""}`}
                >
                  {space.inheritMembers ? (
                    <Link2 size={11} />
                  ) : (
                    <Lock size={11} />
                  )}
                  {space.inheritMembers
                    ? t("app.spaces.inheritOn")
                    : t("app.spaces.inheritOff")}
                </span>
              ) : null}
            </div>
            <span className="sp-row-sub">
              {hasKids ? `${subCountLabel} · ${updatedLabel}` : updatedLabel}
            </span>
          </div>
          <div className="sp-row-metrics">
            <span className="sp-row-metric">
              <Users size={14} />
              {formatCount(space.memberCount, locale)}
            </span>
            <span className="sp-row-metric">
              <ImageIcon size={14} />
              {formatCount(space.albumCount, locale)}
            </span>
          </div>
          <span className="sp-row-arr">
            <ChevronRight size={16} />
          </span>
        </Link>
      </div>

      {hasKids && open ? (
        <div
          className={`sp-children ${space.inheritMembers ? "inherit-on" : "inherit-off"}`}
        >
          {children.map((child) => (
            <TreeNode
              byParent={byParent}
              isChild
              key={child.id}
              space={child}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SpaceTree({
  roots,
  byParent,
}: {
  roots: SpaceDto[];
  byParent: Map<string, SpaceDto[]>;
}) {
  return (
    <div className="sp-tree">
      {roots.map((root) => (
        <div className="sp-tree-root" key={root.id}>
          <TreeNode byParent={byParent} isChild={false} space={root} />
        </div>
      ))}
    </div>
  );
}
