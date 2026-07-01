import type { Route } from "./+types/app-space-detail";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useFetcher } from "react-router";
import {
  ChevronRight,
  FolderOpen,
  Image as ImageIcon,
  Layers,
  Link2,
  Plus,
  Search,
  Share2,
  Users,
} from "lucide-react";
import {
  RoleBadge,
  SpaceCard,
  spaceInitials,
  VisBadge,
} from "~/components/space-card";
import {
  AddMemberDialog,
  ConfirmDialog,
  CreateAlbumDialog,
  CreateInviteDialog,
  CreateSubspaceDialog,
} from "~/components/space-dialogs";
import {
  addSpaceMember,
  changeSpaceMemberRole,
  createSpaceAlbum,
  createSpaceInvite,
  createSubspace,
  getSpace,
  listSpaceAlbums,
  listSpaceInvites,
  listSpaceMembers,
  listSubspaces,
  removeSpaceMember,
  revokeSpaceInvite,
} from "~/lib/api";
import {
  albumPhotoSwatchClass,
  getAlbumPaletteIndex,
} from "~/lib/album-view-prefs";
import { formatDateRange, formatRelativeCount } from "~/lib/format";
import {
  getActiveLocale,
  translateMessage,
  useI18n,
  type MessageKey,
} from "~/lib/i18n";
import { resolveActionIntent, toActionErrorMessage } from "~/lib/route-actions";
import { useSession } from "~/lib/session";
import type {
  AlbumDto,
  InviteLinkDto,
  SpaceDto,
  SpaceMemberDto,
  SpaceRole,
  SpaceVisibility,
} from "~/types/api";

interface SpaceDetailState {
  space: SpaceDto;
  members: SpaceMemberDto[];
  subspaces: SpaceDto[];
  invites: InviteLinkDto[];
  albums: AlbumDto[];
}

interface SpaceDetailLoaderData {
  state: SpaceDetailState;
  ancestors: SpaceDto[];
  spaceId: string;
}

const MANAGE_ROLES: SpaceRole[] = ["OWNER", "ADMIN"];
function canManage(role: SpaceRole | null): boolean {
  return role != null && MANAGE_ROLES.includes(role);
}

async function loadSpaceDetailData(spaceId: string): Promise<SpaceDetailState> {
  const space = await getSpace(spaceId);
  const manage = canManage(space.myRole);
  const [members, subspaces, albums, invites] = await Promise.all([
    listSpaceMembers(spaceId),
    listSubspaces(spaceId),
    listSpaceAlbums(spaceId),
    manage ? listSpaceInvites(spaceId) : Promise.resolve<InviteLinkDto[]>([]),
  ]);
  return { space, members, subspaces, invites, albums };
}

async function loadAncestors(space: SpaceDto): Promise<SpaceDto[]> {
  const chain: SpaceDto[] = [];
  let parentId = space.parentId;
  let guard = 0;
  while (parentId && guard < 5) {
    try {
      const parent = await getSpace(parentId);
      chain.unshift(parent);
      parentId = parent.parentId;
    } catch {
      break;
    }
    guard += 1;
  }
  return chain;
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const spaceId = params.spaceId ?? "";
  const state = await loadSpaceDetailData(spaceId);
  const ancestors = await loadAncestors(state.space);
  return { state, ancestors, spaceId } satisfies SpaceDetailLoaderData;
}

type DetailActionResult = { ok: true } | { ok: false; errorMessage: string };

export async function clientAction({
  request,
  params,
}: Route.ClientActionArgs): Promise<DetailActionResult> {
  const spaceId = params.spaceId ?? "";
  const formData = await request.formData();
  const intent = resolveActionIntent(
    String(formData.get("intent") ?? ""),
    [
      "add-member",
      "change-member-role",
      "remove-member",
      "create-subspace",
      "create-invite",
      "revoke-invite",
      "create-album",
    ] as const,
    "create-album",
  );

  try {
    switch (intent) {
      case "add-member":
        await addSpaceMember(spaceId, {
          userId: String(formData.get("userId") ?? "").trim(),
          role: String(formData.get("role") ?? "VIEWER") as SpaceRole,
        });
        break;
      case "change-member-role":
        await changeSpaceMemberRole(
          spaceId,
          String(formData.get("userId") ?? "").trim(),
          String(formData.get("role") ?? "VIEWER") as SpaceRole,
        );
        break;
      case "remove-member":
        await removeSpaceMember(
          spaceId,
          String(formData.get("userId") ?? "").trim(),
        );
        break;
      case "create-subspace":
        await createSubspace(spaceId, {
          name: String(formData.get("name") ?? "").trim(),
          description: String(formData.get("description") ?? "").trim(),
          visibility: String(
            formData.get("visibility") ?? "PRIVATE",
          ) as SpaceVisibility,
        });
        break;
      case "create-invite":
        await createSpaceInvite(spaceId, {
          defaultRole: String(
            formData.get("defaultRole") ?? "VIEWER",
          ) as SpaceRole,
          expiration: String(formData.get("expiration") ?? "").trim() || null,
          usageLimit: String(formData.get("usageLimit") ?? "").trim()
            ? Number(formData.get("usageLimit"))
            : null,
        });
        break;
      case "revoke-invite":
        await revokeSpaceInvite(
          spaceId,
          String(formData.get("inviteId") ?? "").trim(),
        );
        break;
      case "create-album":
        await createSpaceAlbum(spaceId, {
          name: String(formData.get("name") ?? "").trim(),
          description: String(formData.get("description") ?? "").trim(),
        });
        break;
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      errorMessage: toActionErrorMessage(
        error,
        translateMessage(getActiveLocale(), "app.spaceDetail.actionFailed"),
      ),
    };
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────

const ROLE_KEY: Record<SpaceRole, MessageKey> = {
  OWNER: "app.spaces.roleOwner",
  ADMIN: "app.spaces.roleAdmin",
  MEMBER: "app.spaces.roleMember",
  VIEWER: "app.spaces.roleViewer",
};
type TFunc = ReturnType<typeof useI18n>["t"];
function buildForms(
  t: TFunc,
  one: MessageKey,
  few: MessageKey,
  many: MessageKey,
  other: MessageKey,
) {
  return { one: t(one), few: t(few), many: t(many), other: t(other) };
}
const memberForms = (t: TFunc) =>
  buildForms(
    t,
    "app.spaceDetail.membersUnitOne",
    "app.spaceDetail.membersUnitFew",
    "app.spaceDetail.membersUnitMany",
    "app.spaceDetail.membersUnitOther",
  );
const subForms = (t: TFunc) =>
  buildForms(
    t,
    "app.spaceDetail.subUnitOne",
    "app.spaceDetail.subUnitFew",
    "app.spaceDetail.subUnitMany",
    "app.spaceDetail.subUnitOther",
  );
const linkForms = (t: TFunc) =>
  buildForms(
    t,
    "app.spaceDetail.linkUnitOne",
    "app.spaceDetail.linkUnitFew",
    "app.spaceDetail.linkUnitMany",
    "app.spaceDetail.linkUnitOther",
  );

function EmptyHint({
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
    <div className="spd-empty">
      <div className="spd-empty-ico">{icon}</div>
      <h3 className="spd-empty-title">{title}</h3>
      <p className="spd-empty-text">{text}</p>
      {cta}
    </div>
  );
}

function QRMock({ value }: { value: string }) {
  const size = 21;
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash * 33) ^ value.charCodeAt(i)) >>> 0;
  }
  const next = () => {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    return hash / 4294967296;
  };
  const isFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);
  const cells: ReactNode[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isFinder(r, c) && next() > 0.52) {
        cells.push(<rect height="1" key={`${r}-${c}`} width="1" x={c} y={r} />);
      }
    }
  }
  const finder = (x: number, y: number) => (
    <g key={`f${x}-${y}`}>
      <rect height="7" width="7" x={x} y={y} />
      <rect className="spd-qr-bg" height="5" width="5" x={x + 1} y={y + 1} />
      <rect height="3" width="3" x={x + 2} y={y + 2} />
    </g>
  );
  return (
    <svg
      aria-hidden
      className="spd-qr-svg"
      shapeRendering="crispEdges"
      viewBox={`0 0 ${size} ${size}`}
    >
      {cells}
      {finder(0, 0)}
      {finder(size - 7, 0)}
      {finder(0, size - 7)}
    </svg>
  );
}

function SpaceAlbumCard({
  album,
  spaceId,
}: {
  album: AlbumDto;
  spaceId: string;
}) {
  const { t } = useI18n();
  const paletteIdx = getAlbumPaletteIndex(album.id);
  return (
    <Link
      aria-label={t("app.spaceDetail.openAlbumAria", { name: album.name })}
      className="block overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors hover:border-[var(--color-border-strong)]"
      to={`/app/spaces/${spaceId}/albums/${album.id}`}
    >
      <div
        className={`album-palette-${paletteIdx} relative flex h-28 items-end p-3`}
      >
        <span className="badge badge-glass">
          {t("app.spaceDetail.albumPhotoCount", { count: album.photoCount })}
        </span>
      </div>
      <div className="p-3">
        <h3
          className="truncate text-sm font-semibold tracking-tight"
          title={album.name}
        >
          {album.name}
        </h3>
        {album.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-[var(--color-text-muted)]">
            {album.description}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

function MemberRoleControl({ member }: { member: SpaceMemberDto }) {
  const { t } = useI18n();
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";
  return (
    <fetcher.Form method="post">
      <input name="intent" type="hidden" value="change-member-role" />
      <input name="userId" type="hidden" value={member.userId} />
      <select
        aria-label={t("app.spaceDetail.role")}
        className="field spd-role-select"
        defaultValue={member.role}
        disabled={busy}
        key={member.role}
        name="role"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {(["ADMIN", "MEMBER", "VIEWER"] as SpaceRole[]).map((role) => (
          <option key={role} value={role}>
            {t(ROLE_KEY[role])}
          </option>
        ))}
      </select>
    </fetcher.Form>
  );
}

// ─── Sections ──────────────────────────────────────────────────────────

function AlbumsSection({
  spaceId,
  albums,
  albumCount,
  manage,
}: {
  spaceId: string;
  albums: AlbumDto[];
  albumCount: number;
  manage: boolean;
}) {
  const { t } = useI18n();
  const [createOpen, setCreateOpen] = useState(false);
  const subtitle = `${formatRelativeCount(albumCount, {
    one: t("app.spaceDetail.albumsUnitOne"),
    few: t("app.spaceDetail.albumsUnitFew"),
    many: t("app.spaceDetail.albumsUnitMany"),
    other: t("app.spaceDetail.albumsUnitOther"),
  })} ${t("app.spaceDetail.albumsInThisSpace")}`;

  return (
    <div>
      <div className="spd-sec-head">
        <div>
          <h2 className="spd-sec-title">{t("app.spaceDetail.albumsTitle")}</h2>
          <p className="spd-sec-sub">{subtitle}</p>
        </div>
        {manage && albums.length > 0 ? (
          <button
            className="button-primary btn-sm"
            onClick={() => setCreateOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: ".375rem",
            }}
            type="button"
          >
            <Plus size={15} /> {t("app.spaceDetail.createAlbum")}
          </button>
        ) : null}
      </div>

      {albums.length === 0 ? (
        <EmptyHint
          cta={
            manage ? (
              <button
                className="button-primary"
                onClick={() => setCreateOpen(true)}
                style={{
                  marginTop: ".4rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: ".375rem",
                }}
                type="button"
              >
                <Plus size={16} /> {t("app.spaceDetail.createAlbum")}
              </button>
            ) : undefined
          }
          icon={<FolderOpen size={22} />}
          text={t("app.spaceDetail.emptyAlbumsBody")}
          title={t("app.spaceDetail.emptyAlbumsTitle")}
        />
      ) : (
        <div className="spd-grid">
          {albums.map((album) => (
            <SpaceAlbumCard album={album} key={album.id} spaceId={spaceId} />
          ))}
        </div>
      )}

      {createOpen ? (
        <CreateAlbumDialog onClose={() => setCreateOpen(false)} />
      ) : null}
    </div>
  );
}

function MemberRow({
  member,
  manage,
  isYou,
  onRemove,
}: {
  member: SpaceMemberDto;
  manage: boolean;
  isYou: boolean;
  onRemove: () => void;
}) {
  const { t, locale } = useI18n();
  const paletteIdx = getAlbumPaletteIndex(member.userId);
  return (
    <div className="spd-member">
      <div className={`spd-avatar-token album-palette-${paletteIdx}`}>
        {spaceInitials(member.userName)}
      </div>
      <div className="spd-member-main">
        <div className="spd-member-name">
          {member.userName}
          {isYou ? (
            <span className="spd-member-you">{t("app.spaceDetail.you")}</span>
          ) : null}
        </div>
        <div className="spd-member-sub">
          {t("app.spaceDetail.joinedPrefix")}{" "}
          {formatDateRange(member.joinedAt, member.joinedAt, locale)}
        </div>
      </div>
      <div className="spd-member-actions">
        {manage && member.role !== "OWNER" ? (
          <MemberRoleControl member={member} />
        ) : (
          <RoleBadge role={member.role} />
        )}
        {manage && !isYou && member.role !== "OWNER" ? (
          <button className="text-link-danger" onClick={onRemove} type="button">
            {t("common.remove")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function MembersSection({
  members,
  memberCount,
  manage,
  currentUserId,
}: {
  members: SpaceMemberDto[];
  memberCount: number;
  manage: boolean;
  currentUserId: string;
}) {
  const { t } = useI18n();
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<SpaceMemberDto | null>(null);
  const [query, setQuery] = useState("");
  const onlyMe = members.length <= 1;
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? members.filter((member) =>
        member.userName.toLowerCase().includes(normalized),
      )
    : members;

  return (
    <div>
      <div className="spd-sec-head">
        <div>
          <h2 className="spd-sec-title">{t("app.spaceDetail.membersTitle")}</h2>
          <p className="spd-sec-sub">
            {formatRelativeCount(memberCount, memberForms(t))}
          </p>
        </div>
        {manage && !onlyMe ? (
          <button
            className="button-primary btn-sm"
            onClick={() => setAddOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: ".375rem",
            }}
            type="button"
          >
            <Plus size={15} /> {t("app.spaceDetail.addMember")}
          </button>
        ) : null}
      </div>

      {onlyMe ? (
        <EmptyHint
          cta={
            manage ? (
              <button
                className="button-primary"
                onClick={() => setAddOpen(true)}
                style={{
                  marginTop: ".4rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: ".375rem",
                }}
                type="button"
              >
                <Plus size={16} /> {t("app.spaceDetail.addMember")}
              </button>
            ) : undefined
          }
          icon={<Users size={22} />}
          text={t("app.spaceDetail.emptyMembersBody")}
          title={t("app.spaceDetail.emptyMembersTitle")}
        />
      ) : (
        <>
          {members.length > 6 ? (
            <div
              className="sp-toolbar-search"
              style={{ maxWidth: "22rem", marginBottom: "1rem" }}
            >
              <span className="ico">
                <Search size={15} />
              </span>
              <input
                aria-label={t("app.spaceDetail.searchMembers")}
                className="field"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("app.spaceDetail.searchMembers")}
                type="search"
                value={query}
              />
            </div>
          ) : null}
          <div className="spd-members">
            {filtered.map((member) => (
              <MemberRow
                isYou={member.userId === currentUserId}
                key={member.userId}
                manage={manage}
                member={member}
                onRemove={() => setRemoving(member)}
              />
            ))}
          </div>
        </>
      )}

      {addOpen ? <AddMemberDialog onClose={() => setAddOpen(false)} /> : null}
      {removing ? (
        <ConfirmDialog
          body={t("app.spaceDetail.confirmRemoveBody", {
            name: removing.userName,
          })}
          confirmLabel={t("common.remove")}
          fields={{ intent: "remove-member", userId: removing.userId }}
          onClose={() => setRemoving(null)}
          title={t("app.spaceDetail.confirmRemoveTitle")}
        />
      ) : null}
    </div>
  );
}

function SubspacesSection({
  space,
  subspaces,
  manage,
}: {
  space: SpaceDto;
  subspaces: SpaceDto[];
  manage: boolean;
}) {
  const { t } = useI18n();
  const [createOpen, setCreateOpen] = useState(false);
  const atLimit = space.depth >= 5;

  const createButton = manage ? (
    <button
      className="button-primary btn-sm"
      disabled={atLimit}
      onClick={() => setCreateOpen(true)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: ".375rem",
        opacity: atLimit ? 0.5 : 1,
      }}
      title={atLimit ? t("app.spaceDetail.depthLimitTitle") : undefined}
      type="button"
    >
      <Plus size={15} /> {t("app.spaceDetail.createSub")}
    </button>
  ) : null;

  return (
    <div>
      <div className="spd-sec-head">
        <div>
          <h2 className="spd-sec-title">{t("app.spaceDetail.subTitle")}</h2>
          <p className="spd-sec-sub">
            {formatRelativeCount(subspaces.length, subForms(t))}
          </p>
        </div>
        {subspaces.length > 0 ? createButton : null}
      </div>

      {manage && atLimit ? (
        <div className="inline-msg info" style={{ marginBottom: "1rem" }}>
          <Layers size={16} />
          <span>{t("app.spaceDetail.depthLimitBody")}</span>
        </div>
      ) : null}

      {subspaces.length === 0 ? (
        <EmptyHint
          cta={
            manage && !atLimit ? (
              <button
                className="button-primary"
                onClick={() => setCreateOpen(true)}
                style={{
                  marginTop: ".4rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: ".375rem",
                }}
                type="button"
              >
                <Plus size={16} /> {t("app.spaceDetail.createSub")}
              </button>
            ) : undefined
          }
          icon={<Layers size={22} />}
          text={
            atLimit
              ? t("app.spaceDetail.depthLimitBody")
              : t("app.spaceDetail.emptySubBody")
          }
          title={t("app.spaceDetail.emptySubTitle")}
        />
      ) : (
        <div className="spd-grid">
          {subspaces.map((child) => (
            <SpaceCard childCount={0} key={child.id} space={child} />
          ))}
        </div>
      )}

      {createOpen ? (
        <CreateSubspaceDialog onClose={() => setCreateOpen(false)} />
      ) : null}
    </div>
  );
}

function InviteRow({
  invite,
  copied,
  onCopy,
  onRevoke,
}: {
  invite: InviteLinkDto;
  copied: boolean;
  onCopy: () => void;
  onRevoke: () => void;
}) {
  const { t, locale } = useI18n();
  return (
    <div className="spd-invite">
      <div className="spd-qr">
        <QRMock value={invite.code} />
      </div>
      <div className="spd-invite-main">
        <div className="spd-invite-codeline">
          <span className="spd-invite-code">{invite.code}</span>
          <button
            className={`spd-copy ${copied ? "done" : ""}`}
            onClick={onCopy}
            type="button"
          >
            <Share2 size={13} />
            {copied ? t("app.spaceDetail.copied") : t("app.spaceDetail.copy")}
          </button>
          <RoleBadge role={invite.defaultRole} />
        </div>
        <div className="spd-invite-meta">
          <span>
            {t("app.spaceDetail.usage")}{" "}
            <b>
              {invite.usageCount}
              {invite.usageLimit != null
                ? ` / ${invite.usageLimit}`
                : ` (${t("app.spaceDetail.noLimit")})`}
            </b>
          </span>
          <span>
            {t("app.spaceDetail.expires")}{" "}
            <b>
              {invite.expiration
                ? formatDateRange(invite.expiration, invite.expiration, locale)
                : t("app.spaceDetail.noExpiry")}
            </b>
          </span>
          <span className={`spd-status ${invite.active ? "on" : "off"}`}>
            <span className="dot" />
            {invite.active
              ? t("app.spaceDetail.active")
              : t("app.spaceDetail.inactive")}
          </span>
        </div>
      </div>
      <div className="spd-invite-actions">
        {invite.active ? (
          <button className="text-link-danger" onClick={onRevoke} type="button">
            {t("app.spaceDetail.revoke")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function InvitesSection({ invites }: { invites: InviteLinkDto[] }) {
  const { t } = useI18n();
  const [createOpen, setCreateOpen] = useState(false);
  const [revoking, setRevoking] = useState<InviteLinkDto | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const activeCount = invites.filter((invite) => invite.active).length;

  const copy = (code: string) => {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://pina.app";
    navigator.clipboard?.writeText(`${origin}/join/${code}`).catch(() => {});
    setCopied(code);
    window.setTimeout(() => {
      setCopied((current) => (current === code ? null : current));
    }, 1600);
  };

  return (
    <div>
      <div className="spd-sec-head">
        <div>
          <h2 className="spd-sec-title">{t("app.spaceDetail.invTitle")}</h2>
          <p className="spd-sec-sub">
            {formatRelativeCount(activeCount, linkForms(t))}
          </p>
        </div>
        {invites.length > 0 ? (
          <button
            className="button-primary btn-sm"
            onClick={() => setCreateOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: ".375rem",
            }}
            type="button"
          >
            <Plus size={15} /> {t("app.spaceDetail.createInvite")}
          </button>
        ) : null}
      </div>

      {invites.length === 0 ? (
        <EmptyHint
          cta={
            <button
              className="button-primary"
              onClick={() => setCreateOpen(true)}
              style={{
                marginTop: ".4rem",
                display: "inline-flex",
                alignItems: "center",
                gap: ".375rem",
              }}
              type="button"
            >
              <Plus size={16} /> {t("app.spaceDetail.createInvite")}
            </button>
          }
          icon={<Link2 size={22} />}
          text={t("app.spaceDetail.emptyInvBody")}
          title={t("app.spaceDetail.emptyInvTitle")}
        />
      ) : (
        <div className="spd-invites">
          {invites.map((invite) => (
            <InviteRow
              copied={copied === invite.code}
              invite={invite}
              key={invite.id}
              onCopy={() => copy(invite.code)}
              onRevoke={() => setRevoking(invite)}
            />
          ))}
        </div>
      )}

      {createOpen ? (
        <CreateInviteDialog onClose={() => setCreateOpen(false)} />
      ) : null}
      {revoking ? (
        <ConfirmDialog
          body={t("app.spaceDetail.confirmRevokeBody")}
          confirmLabel={t("app.spaceDetail.confirmRevokeBtn")}
          fields={{ intent: "revoke-invite", inviteId: revoking.id }}
          onClose={() => setRevoking(null)}
          title={t("app.spaceDetail.confirmRevokeTitle")}
        />
      ) : null}
    </div>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────

type TabId = "albums" | "members" | "subspaces" | "invites";

export default function AppSpaceDetailRoute({
  loaderData,
}: Route.ComponentProps) {
  const { t, locale } = useI18n();
  const session = useSession();
  const currentUserId = session?.user.id ?? "";
  const { state, ancestors } = loaderData;
  const space = state.space;
  const manage = canManage(space.myRole);
  const paletteIdx = getAlbumPaletteIndex(space.id);
  const countFormatter = new Intl.NumberFormat(locale);

  const [tab, setTab] = useState<TabId>("albums");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createAlbumOpen, setCreateAlbumOpen] = useState(false);

  useEffect(() => {
    if (tab === "invites" && !manage) {
      setTab("albums");
    }
  }, [manage, tab]);

  const tabs = useMemo(() => {
    const base: Array<{ id: TabId; label: string; count: number }> = [
      {
        id: "albums",
        label: t("app.spaceDetail.tabAlbums"),
        count: space.albumCount,
      },
      {
        id: "members",
        label: t("app.spaceDetail.tabMembers"),
        count: space.memberCount,
      },
      {
        id: "subspaces",
        label: t("app.spaceDetail.tabSub"),
        count: state.subspaces.length,
      },
    ];
    if (manage) {
      base.push({
        id: "invites",
        label: t("app.spaceDetail.tabInvites"),
        count: state.invites.filter((invite) => invite.active).length,
      });
    }
    return base;
  }, [
    manage,
    space.albumCount,
    space.memberCount,
    state.subspaces,
    state.invites,
    t,
  ]);

  const crumbs = [...ancestors, space];

  return (
    <div className="spd-page" data-screen-label="Space Detail">
      <nav
        aria-label={t("app.spaceDetail.breadcrumbAria")}
        className="spd-crumbs"
      >
        <Link className="spd-crumb spd-crumb-link" to="/app/spaces">
          <Users size={14} /> {t("app.spaceDetail.backToSpaces")}
        </Link>
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <Fragment key={crumb.id}>
              <span className="spd-crumb-sep">
                <ChevronRight size={13} />
              </span>
              {last ? (
                <span aria-current="page" className="spd-crumb spd-crumb-cur">
                  {crumb.name}
                </span>
              ) : (
                <Link
                  className="spd-crumb spd-crumb-link"
                  to={`/app/spaces/${crumb.id}`}
                >
                  {crumb.name}
                </Link>
              )}
            </Fragment>
          );
        })}
      </nav>

      <header className={`spd-hero album-palette-${paletteIdx}`}>
        <div className="spd-hero-grad" />
        <div aria-hidden className="spd-hero-mosaic">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <i className={albumPhotoSwatchClass(paletteIdx + i)} key={i} />
          ))}
        </div>
        {manage ? (
          <div className="spd-hero-actions">
            <button
              className="btn-glass"
              onClick={() => setInviteOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: ".4rem",
              }}
              type="button"
            >
              <Link2 size={15} /> {t("app.spaceDetail.invite")}
            </button>
            <button
              className="btn-glass"
              onClick={() => setCreateAlbumOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: ".4rem",
              }}
              type="button"
            >
              <Plus size={15} /> {t("app.spaceDetail.createAlbum")}
            </button>
          </div>
        ) : null}
        <div className="spd-hero-body">
          <div
            className={`spd-hero-avatar album-palette-${(paletteIdx + 1) % 8}`}
          >
            {spaceInitials(space.name)}
          </div>
          <div className="spd-hero-info">
            <div className="spd-hero-badges">
              <VisBadge glass visibility={space.visibility} />
              {space.myRole ? <RoleBadge glass role={space.myRole} /> : null}
              <span className="badge badge-glass">
                {space.depth === 0
                  ? t("app.spaces.chipRoot")
                  : t("app.spaces.chipLevel", { count: space.depth })}
              </span>
            </div>
            <h1 className="spd-hero-name">{space.name}</h1>
            {space.description ? (
              <p className="spd-hero-desc">{space.description}</p>
            ) : null}
            <div className="spd-hero-metrics">
              <div className="spd-hero-metric">
                <b>
                  <Users size={16} />
                  {countFormatter.format(space.memberCount)}
                </b>
                <span>{t("app.spaceDetail.metaMembers")}</span>
              </div>
              <div className="spd-hero-metric">
                <b>
                  <ImageIcon size={16} />
                  {countFormatter.format(space.albumCount)}
                </b>
                <span>{t("app.spaceDetail.metaAlbums")}</span>
              </div>
              <div className="spd-hero-metric">
                <b>
                  <Layers size={16} />
                  {state.subspaces.length}
                </b>
                <span>{t("app.spaceDetail.metaSub")}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div aria-label={space.name} className="spd-tabs" role="tablist">
        {tabs.map((entry) => (
          <button
            aria-selected={tab === entry.id}
            className={`spd-tab ${tab === entry.id ? "spd-tab-active" : ""}`}
            key={entry.id}
            onClick={() => setTab(entry.id)}
            role="tab"
            type="button"
          >
            {entry.label}
            <span className="spd-tab-count">{entry.count}</span>
          </button>
        ))}
      </div>

      <div>
        {tab === "albums" ? (
          <AlbumsSection
            albumCount={space.albumCount}
            albums={state.albums}
            manage={manage}
            spaceId={space.id}
          />
        ) : null}
        {tab === "members" ? (
          <MembersSection
            currentUserId={currentUserId}
            manage={manage}
            memberCount={space.memberCount}
            members={state.members}
          />
        ) : null}
        {tab === "subspaces" ? (
          <SubspacesSection
            manage={manage}
            space={space}
            subspaces={state.subspaces}
          />
        ) : null}
        {tab === "invites" && manage ? (
          <InvitesSection invites={state.invites} />
        ) : null}
      </div>

      {inviteOpen ? (
        <CreateInviteDialog onClose={() => setInviteOpen(false)} />
      ) : null}
      {createAlbumOpen ? (
        <CreateAlbumDialog onClose={() => setCreateAlbumOpen(false)} />
      ) : null}
    </div>
  );
}
