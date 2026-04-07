import type { Route } from "./+types/app-space-detail";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Form,
  Link,
  useActionData,
  useNavigation,
  useParams,
  useRevalidator,
} from "react-router";
import {
  EmptyHint,
  FilterToolbar,
  InlineMessage,
  PageHeader,
  Panel,
  SurfaceCard,
} from "~/components/ui";
import {
  addPhotoToSpaceAlbum,
  addSpaceMember,
  ApiError,
  changeSpaceMemberRole,
  createSpaceAlbum,
  createSpaceInvite,
  createSubspace,
  deleteSpaceAlbum,
  getSpace,
  listAllPhotos,
  listAllSpaceAlbumPhotos,
  listSpaceAlbums,
  listSpaceInvites,
  listSpaceMembers,
  listSubspaces,
  removePhotoFromSpaceAlbum,
  removeSpaceMember,
  revokeSpaceInvite,
  updateSpaceAlbum,
} from "~/lib/api";
import { formatDateTime } from "~/lib/format";
import { resolveActionIntent, toActionErrorMessage } from "~/lib/route-actions";
import type {
  AlbumDto,
  InviteLinkDto,
  PhotoDto,
  SpaceDto,
  SpaceMemberDto,
  SpaceRole,
  SpaceVisibility,
} from "~/types/api";

interface SpaceDetailState {
  space: SpaceDto | null;
  members: SpaceMemberDto[];
  subspaces: SpaceDto[];
  invites: InviteLinkDto[];
  albums: AlbumDto[];
}

const emptyAlbumDraft = {
  name: "",
  description: "",
};

interface SpaceDetailLoaderData {
  state: SpaceDetailState;
  spaceId: string;
}

type SpaceDetailActionIntent =
  | "add-member"
  | "change-member-role"
  | "remove-member"
  | "create-subspace"
  | "create-invite"
  | "revoke-invite"
  | "create-album"
  | "update-album"
  | "delete-album"
  | "add-album-photo"
  | "remove-album-photo";

type SpaceDetailActionResult =
  | {
      ok: true;
      intent: SpaceDetailActionIntent;
      albumId?: string;
      photoId?: string;
      userId?: string;
      inviteId?: string;
    }
  | { ok: false; intent: SpaceDetailActionIntent; errorMessage: string };

async function loadSpaceDetailData(spaceId: string): Promise<SpaceDetailState> {
  const [space, members, subspaces, invites, albums] = await Promise.all([
    getSpace(spaceId),
    listSpaceMembers(spaceId),
    listSubspaces(spaceId),
    listSpaceInvites(spaceId),
    listSpaceAlbums(spaceId),
  ]);

  return {
    space,
    members,
    subspaces,
    invites,
    albums,
  };
}

async function loadLibraryPhotosForSpace(): Promise<PhotoDto[]> {
  return listAllPhotos();
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const spaceId = params.spaceId ?? "";
  const state = await loadSpaceDetailData(spaceId);

  return {
    state,
    spaceId,
  } satisfies SpaceDetailLoaderData;
}

export async function clientAction({
  request,
  params,
}: Route.ClientActionArgs): Promise<SpaceDetailActionResult> {
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
      "update-album",
      "delete-album",
      "add-album-photo",
      "remove-album-photo",
    ] as const,
    "create-invite",
  );

  try {
    switch (intent) {
      case "add-member":
        await addSpaceMember(spaceId, {
          userId: String(formData.get("userId") ?? "").trim(),
          role: String(formData.get("role") ?? "VIEWER") as SpaceRole,
        });
        return { ok: true, intent };
      case "change-member-role": {
        const userId = String(formData.get("userId") ?? "").trim();
        await changeSpaceMemberRole(
          spaceId,
          userId,
          String(formData.get("role") ?? "VIEWER") as SpaceRole,
        );
        return { ok: true, intent, userId };
      }
      case "remove-member": {
        const userId = String(formData.get("userId") ?? "").trim();
        await removeSpaceMember(spaceId, userId);
        return { ok: true, intent, userId };
      }
      case "create-subspace":
        await createSubspace(spaceId, {
          name: String(formData.get("name") ?? "").trim(),
          description: String(formData.get("description") ?? "").trim(),
          visibility: String(
            formData.get("visibility") ?? "PRIVATE",
          ) as SpaceVisibility,
        });
        return { ok: true, intent };
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
        return { ok: true, intent };
      case "revoke-invite": {
        const inviteId = String(formData.get("inviteId") ?? "").trim();
        await revokeSpaceInvite(spaceId, inviteId);
        return { ok: true, intent, inviteId };
      }
      case "create-album":
        await createSpaceAlbum(spaceId, {
          name: String(formData.get("name") ?? "").trim(),
          description: String(formData.get("description") ?? "").trim(),
        });
        return { ok: true, intent };
      case "update-album": {
        const albumId = String(formData.get("albumId") ?? "");
        await updateSpaceAlbum(spaceId, albumId, {
          name: String(formData.get("name") ?? "").trim(),
          description: String(formData.get("description") ?? "").trim(),
        });
        return { ok: true, intent, albumId };
      }
      case "delete-album": {
        const albumId = String(formData.get("albumId") ?? "");
        await deleteSpaceAlbum(spaceId, albumId);
        return { ok: true, intent, albumId };
      }
      case "add-album-photo": {
        const albumId = String(formData.get("albumId") ?? "");
        const photoId = String(formData.get("photoId") ?? "");
        await addPhotoToSpaceAlbum(spaceId, albumId, photoId);
        return { ok: true, intent, albumId, photoId };
      }
      case "remove-album-photo": {
        const albumId = String(formData.get("albumId") ?? "");
        const photoId = String(formData.get("photoId") ?? "");
        await removePhotoFromSpaceAlbum(spaceId, albumId, photoId);
        return { ok: true, intent, albumId, photoId };
      }
      default:
        return {
          ok: false,
          intent: "create-invite",
          errorMessage: "Unknown Space action.",
        };
    }
  } catch (error) {
    return {
      ok: false,
      intent,
      errorMessage: toActionErrorMessage(error, "Space action failed."),
    };
  }
}

export default function AppSpaceDetailRoute({
  loaderData,
}: Route.ComponentProps) {
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const params = useParams();
  const spaceId = loaderData.spaceId || params.spaceId || "";
  const [state, setState] = useState<SpaceDetailState>(loaderData.state);
  const [libraryPhotos, setLibraryPhotos] = useState<PhotoDto[] | null>(null);
  const [isLibraryPhotosLoading, setIsLibraryPhotosLoading] = useState(false);
  const [libraryPhotosError, setLibraryPhotosError] = useState<string | null>(
    null,
  );
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [selectedAlbumPhotos, setSelectedAlbumPhotos] = useState<PhotoDto[]>(
    [],
  );
  const [selectedAlbumDraft, setSelectedAlbumDraft] = useState(emptyAlbumDraft);
  const [albumCreateDraft, setAlbumCreateDraft] = useState(emptyAlbumDraft);
  const [albumPhotoDraft, setAlbumPhotoDraft] = useState("");
  const [detailFilter, setDetailFilter] = useState("");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [subspaceError, setSubspaceError] = useState<string | null>(null);
  const [albumError, setAlbumError] = useState<string | null>(null);
  const [memberDraft, setMemberDraft] = useState({
    userId: "",
    role: "VIEWER" as SpaceRole,
  });
  const [subspaceDraft, setSubspaceDraft] = useState({
    name: "",
    description: "",
    visibility: "PRIVATE" as SpaceVisibility,
  });
  const [inviteDraft, setInviteDraft] = useState({
    defaultRole: "VIEWER" as SpaceRole,
    expiration: "",
    usageLimit: "",
  });
  const pendingIntent = String(navigation.formData?.get("intent") ?? "");
  const pendingAlbumId = String(navigation.formData?.get("albumId") ?? "");
  const pendingUserId = String(navigation.formData?.get("userId") ?? "");
  const pendingInviteId = String(navigation.formData?.get("inviteId") ?? "");
  const pendingPhotoId = String(navigation.formData?.get("photoId") ?? "");
  const normalizedDetailFilter = detailFilter.trim().toLowerCase();
  const filteredMembers = useMemo(
    () =>
      state.members.filter((member) => {
        if (normalizedDetailFilter.length === 0) {
          return true;
        }
        return (
          member.userName.toLowerCase().includes(normalizedDetailFilter) ||
          member.userId.toLowerCase().includes(normalizedDetailFilter) ||
          member.role.toLowerCase().includes(normalizedDetailFilter)
        );
      }),
    [normalizedDetailFilter, state.members],
  );
  const filteredSubspaces = useMemo(
    () =>
      state.subspaces.filter((subspace) => {
        if (normalizedDetailFilter.length === 0) {
          return true;
        }
        return (
          subspace.name.toLowerCase().includes(normalizedDetailFilter) ||
          (subspace.description ?? "")
            .toLowerCase()
            .includes(normalizedDetailFilter) ||
          subspace.visibility.toLowerCase().includes(normalizedDetailFilter)
        );
      }),
    [normalizedDetailFilter, state.subspaces],
  );
  const filteredAlbums = useMemo(
    () =>
      state.albums.filter((album) => {
        if (normalizedDetailFilter.length === 0) {
          return true;
        }
        return (
          album.name.toLowerCase().includes(normalizedDetailFilter) ||
          (album.description ?? "")
            .toLowerCase()
            .includes(normalizedDetailFilter)
        );
      }),
    [normalizedDetailFilter, state.albums],
  );
  const filteredInvites = useMemo(
    () =>
      state.invites.filter((invite) => {
        if (normalizedDetailFilter.length === 0) {
          return true;
        }
        return (
          invite.code.toLowerCase().includes(normalizedDetailFilter) ||
          invite.defaultRole.toLowerCase().includes(normalizedDetailFilter)
        );
      }),
    [normalizedDetailFilter, state.invites],
  );

  const selectedAlbum =
    state.albums.find((album) => album.id === selectedAlbumId) ?? null;
  const availableLibraryPhotos = useMemo(
    () =>
      (libraryPhotos ?? []).filter(
        (photo) =>
          !selectedAlbumPhotos.some((albumPhoto) => albumPhoto.id === photo.id),
      ),
    [libraryPhotos, selectedAlbumPhotos],
  );

  const reloadSelectedAlbumPhotos = useCallback(
    async (albumId: string) => {
      try {
        setAlbumError(null);
        const items = await listAllSpaceAlbumPhotos(spaceId, albumId);
        setSelectedAlbumPhotos(items);
        setAlbumPhotoDraft("");
      } catch (error) {
        if (error instanceof ApiError) {
          setAlbumError(error.message);
        } else {
          setAlbumError("Failed to load album photos.");
        }
      }
    },
    [spaceId],
  );

  const ensureLibraryPhotosLoaded = useCallback(async () => {
    if (libraryPhotos !== null || isLibraryPhotosLoading) {
      return;
    }

    try {
      setLibraryPhotosError(null);
      setIsLibraryPhotosLoading(true);
      const items = await loadLibraryPhotosForSpace();
      setLibraryPhotos(items);
    } catch (error) {
      if (error instanceof ApiError) {
        setLibraryPhotosError(error.message);
      } else {
        setLibraryPhotosError("Failed to load personal library photos.");
      }
    } finally {
      setIsLibraryPhotosLoading(false);
    }
  }, [isLibraryPhotosLoading, libraryPhotos]);

  useEffect(() => {
    setState(loaderData.state);
  }, [loaderData]);

  useEffect(() => {
    const currentAlbum = state.albums.find(
      (album) => album.id === selectedAlbumId,
    );
    if (currentAlbum) {
      setSelectedAlbumDraft({
        name: currentAlbum.name,
        description: currentAlbum.description ?? "",
      });
      return;
    }

    if (state.albums.length > 0) {
      const firstAlbum = state.albums[0];
      setSelectedAlbumId(firstAlbum.id);
      setSelectedAlbumDraft({
        name: firstAlbum.name,
        description: firstAlbum.description ?? "",
      });
      return;
    }

    if (selectedAlbumId !== null) {
      setSelectedAlbumId(null);
    }
    setSelectedAlbumDraft(emptyAlbumDraft);
    setSelectedAlbumPhotos([]);
    setAlbumPhotoDraft("");
  }, [state.albums, selectedAlbumId]);

  useEffect(() => {
    if (!spaceId || !selectedAlbumId) {
      setSelectedAlbumPhotos([]);
      setAlbumPhotoDraft("");
      return;
    }

    void reloadSelectedAlbumPhotos(selectedAlbumId);
  }, [reloadSelectedAlbumPhotos, selectedAlbumId, spaceId]);

  useEffect(() => {
    if (!selectedAlbumId) {
      return;
    }

    void ensureLibraryPhotosLoaded();
  }, [ensureLibraryPhotosLoaded, selectedAlbumId]);

  useEffect(() => {
    if (!actionData) {
      return;
    }

    if (actionData.ok) {
      setMemberError(null);
      setInviteError(null);
      setSubspaceError(null);
      setAlbumError(null);

      if (actionData.intent === "add-member") {
        setMemberDraft({ userId: "", role: "VIEWER" });
      }
      if (actionData.intent === "create-subspace") {
        setSubspaceDraft({ name: "", description: "", visibility: "PRIVATE" });
      }
      if (actionData.intent === "create-invite") {
        setInviteDraft({
          defaultRole: "VIEWER",
          expiration: "",
          usageLimit: "",
        });
      }
      if (actionData.intent === "create-album") {
        setAlbumCreateDraft(emptyAlbumDraft);
      }
      if (
        actionData.intent === "add-album-photo" ||
        actionData.intent === "remove-album-photo"
      ) {
        if (selectedAlbumId && actionData.albumId === selectedAlbumId) {
          void reloadSelectedAlbumPhotos(selectedAlbumId);
          setAlbumPhotoDraft("");
        }
        return;
      }
      if (
        actionData.intent === "delete-album" &&
        actionData.albumId === selectedAlbumId
      ) {
        setSelectedAlbumId(null);
      }

      revalidator.revalidate();
      return;
    }

    if (
      actionData.intent === "add-member" ||
      actionData.intent === "change-member-role" ||
      actionData.intent === "remove-member"
    ) {
      setMemberError(actionData.errorMessage);
      return;
    }
    if (actionData.intent === "create-subspace") {
      setSubspaceError(actionData.errorMessage);
      return;
    }
    if (
      actionData.intent === "create-invite" ||
      actionData.intent === "revoke-invite"
    ) {
      setInviteError(actionData.errorMessage);
      return;
    }
    setAlbumError(actionData.errorMessage);
  }, [actionData, reloadSelectedAlbumPhotos, revalidator, selectedAlbumId]);

  if (!spaceId) {
    return (
      <Panel className="p-6">
        <p className="text-sm text-[var(--color-danger-strong)]">
          Space id is missing.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        actions={
          <Link className="button-secondary" to="/app/spaces">
            Back to Spaces
          </Link>
        }
        description={
          state.space?.description ||
          "Manage members, subspaces, albums, and invites from a single route."
        }
        eyebrow="Space Detail"
        title={state.space?.name || "Loading Space"}
      />

      {state.space ? (
        <section className="grid gap-4 md:grid-cols-5">
          <Panel className="p-5">
            <p className="eyebrow">Visibility</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight">
              {state.space.visibility.toLowerCase()}
            </p>
          </Panel>
          <Panel className="p-5">
            <p className="eyebrow">Members</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight">
              {state.members.length}
            </p>
          </Panel>
          <Panel className="p-5">
            <p className="eyebrow">Subspaces</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight">
              {state.subspaces.length}
            </p>
          </Panel>
          <Panel className="p-5">
            <p className="eyebrow">Albums</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight">
              {state.albums.length}
            </p>
          </Panel>
          <Panel className="p-5">
            <p className="eyebrow">Invites</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight">
              {state.invites.length}
            </p>
          </Panel>
        </section>
      ) : null}

      <FilterToolbar
        controls={
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
            <input
              aria-label="Filter Space detail"
              className="field min-w-0 md:min-w-80"
              onChange={(event) => setDetailFilter(event.target.value)}
              placeholder="Filter by name, role, code, or description"
              type="search"
              value={detailFilter}
            />
            <button
              className="button-secondary"
              disabled={normalizedDetailFilter.length === 0}
              onClick={() => setDetailFilter("")}
              type="button"
            >
              Clear filter
            </button>
          </div>
        }
        description="Narrow members, subspaces, albums, and invites without leaving the current Space."
        title="Local filter"
      />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Panel className="p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Members</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  Current membership
                </h2>
              </div>
            </div>

            {memberError ? (
              <InlineMessage className="mt-4" tone="danger">
                {memberError}
              </InlineMessage>
            ) : null}

            <Form
              className="mt-5 grid gap-3 md:grid-cols-[1fr_180px_auto]"
              method="post"
            >
              <input name="intent" type="hidden" value="add-member" />
              <input
                className="field"
                name="userId"
                onChange={(event) =>
                  setMemberDraft((current) => ({
                    ...current,
                    userId: event.target.value,
                  }))
                }
                placeholder="User UUID"
                required
                value={memberDraft.userId}
              />
              <select
                aria-label="Add member role"
                className="field"
                name="role"
                onChange={(event) =>
                  setMemberDraft((current) => ({
                    ...current,
                    role: event.target.value as SpaceRole,
                  }))
                }
                value={memberDraft.role}
              >
                <option value="VIEWER">Viewer</option>
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button
                className="button-primary"
                disabled={pendingIntent === "add-member"}
                type="submit"
              >
                {pendingIntent === "add-member" ? "Adding..." : "Add member"}
              </button>
            </Form>

            <div className="mt-5 space-y-3">
              {filteredMembers.length === 0 ? (
                <EmptyHint>No members match the current filter.</EmptyHint>
              ) : (
                filteredMembers.map((member) => (
                  <SurfaceCard className="rounded-2xl p-4" key={member.userId}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold tracking-tight">
                          {member.userName}
                        </h3>
                        <p className="mt-1 break-all text-sm text-[var(--color-text-muted)]">
                          {member.userId}
                        </p>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Form method="post">
                          <input
                            name="intent"
                            type="hidden"
                            value="change-member-role"
                          />
                          <input
                            name="userId"
                            type="hidden"
                            value={member.userId}
                          />
                          <select
                            aria-label={`Role for ${member.userName}`}
                            className="field min-w-36"
                            disabled={
                              pendingIntent === "change-member-role" &&
                              pendingUserId === member.userId
                            }
                            name="role"
                            onChange={(event) => {
                              event.currentTarget.form?.requestSubmit();
                            }}
                            value={member.role}
                          >
                            <option value="OWNER">Owner</option>
                            <option value="ADMIN">Admin</option>
                            <option value="MEMBER">Member</option>
                            <option value="VIEWER">Viewer</option>
                          </select>
                        </Form>
                        <Form method="post">
                          <input
                            name="intent"
                            type="hidden"
                            value="remove-member"
                          />
                          <input
                            name="userId"
                            type="hidden"
                            value={member.userId}
                          />
                          <button
                            className="button-secondary"
                            disabled={
                              pendingIntent === "remove-member" &&
                              pendingUserId === member.userId
                            }
                            type="submit"
                          >
                            {pendingIntent === "remove-member" &&
                            pendingUserId === member.userId
                              ? "Removing..."
                              : "Remove"}
                          </button>
                        </Form>
                      </div>
                    </div>
                  </SurfaceCard>
                ))
              )}
            </div>
          </Panel>

          <Panel className="p-6">
            <p className="eyebrow">Subspaces</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Hierarchy
            </h2>

            {subspaceError ? (
              <InlineMessage className="mt-4" tone="danger">
                {subspaceError}
              </InlineMessage>
            ) : null}

            <Form className="mt-5 space-y-3" method="post">
              <input name="intent" type="hidden" value="create-subspace" />
              <input
                className="field"
                name="name"
                onChange={(event) =>
                  setSubspaceDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Subspace name"
                required
                value={subspaceDraft.name}
              />
              <textarea
                className="field min-h-24 resize-y"
                name="description"
                onChange={(event) =>
                  setSubspaceDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Description"
                value={subspaceDraft.description}
              />
              <div className="flex gap-3">
                <select
                  aria-label="Subspace visibility"
                  className="field"
                  name="visibility"
                  onChange={(event) =>
                    setSubspaceDraft((current) => ({
                      ...current,
                      visibility: event.target.value as SpaceVisibility,
                    }))
                  }
                  value={subspaceDraft.visibility}
                >
                  <option value="PRIVATE">Private</option>
                  <option value="PUBLIC">Public</option>
                </select>
                <button
                  className="button-primary"
                  disabled={pendingIntent === "create-subspace"}
                  type="submit"
                >
                  {pendingIntent === "create-subspace"
                    ? "Creating..."
                    : "Create subspace"}
                </button>
              </div>
            </Form>

            <div className="mt-5 space-y-3">
              {state.subspaces.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">
                  No subspaces yet.
                </p>
              ) : filteredSubspaces.length === 0 ? (
                <EmptyHint>No subspaces match the current filter.</EmptyHint>
              ) : (
                filteredSubspaces.map((subspace) => (
                  <SurfaceCard className="rounded-2xl p-4" key={subspace.id}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold tracking-tight">
                          {subspace.name}
                        </h3>
                        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                          {subspace.visibility.toLowerCase()} · depth{" "}
                          {subspace.depth}
                        </p>
                      </div>
                      <Link
                        className="button-secondary"
                        to={`/app/spaces/${subspace.id}`}
                      >
                        Open
                      </Link>
                    </div>
                  </SurfaceCard>
                ))
              )}
            </div>
          </Panel>

          <Panel className="p-6">
            <p className="eyebrow">Albums</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Shared Space albums
            </h2>

            {albumError ? (
              <InlineMessage className="mt-4" tone="danger">
                {albumError}
              </InlineMessage>
            ) : null}

            <Form className="mt-5 space-y-3" method="post">
              <input name="intent" type="hidden" value="create-album" />
              <input
                aria-label="New album name"
                className="field"
                name="name"
                onChange={(event) =>
                  setAlbumCreateDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Album name"
                required
                value={albumCreateDraft.name}
              />
              <textarea
                aria-label="New album description"
                className="field min-h-24 resize-y"
                name="description"
                onChange={(event) =>
                  setAlbumCreateDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Album description"
                value={albumCreateDraft.description}
              />
              <button
                className="button-primary"
                disabled={pendingIntent === "create-album"}
                type="submit"
              >
                {pendingIntent === "create-album"
                  ? "Creating..."
                  : "Create album"}
              </button>
            </Form>

            <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-3">
                {state.albums.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-muted)]">
                    No shared albums yet.
                  </p>
                ) : filteredAlbums.length === 0 ? (
                  <EmptyHint>No albums match the current filter.</EmptyHint>
                ) : (
                  filteredAlbums.map((album) => (
                    <article
                      className={`rounded-2xl border p-4 ${
                        album.id === selectedAlbumId
                          ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                          : "surface-card"
                      }`}
                      key={album.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold tracking-tight">
                            {album.name}
                          </h3>
                          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                            {album.description || "No description yet."}
                          </p>
                        </div>
                        <button
                          className="button-secondary"
                          onClick={() => {
                            setSelectedAlbumId(album.id);
                          }}
                          type="button"
                        >
                          {album.id === selectedAlbumId ? "Selected" : "Open"}
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <SurfaceCard className="rounded-3xl p-5">
                {selectedAlbum ? (
                  <div className="space-y-5">
                    <div>
                      <p className="eyebrow">Selected album</p>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight">
                        {selectedAlbum.name}
                      </h3>
                    </div>

                    <div className="space-y-3">
                      <Form className="space-y-3" method="post">
                        <input
                          name="intent"
                          type="hidden"
                          value="update-album"
                        />
                        <input
                          name="albumId"
                          type="hidden"
                          value={selectedAlbumId ?? ""}
                        />
                        <input
                          aria-label="Selected album name"
                          className="field"
                          name="name"
                          onChange={(event) =>
                            setSelectedAlbumDraft((current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                          placeholder="Album name"
                          required
                          value={selectedAlbumDraft.name}
                        />
                        <textarea
                          aria-label="Selected album description"
                          className="field min-h-24 resize-y"
                          name="description"
                          onChange={(event) =>
                            setSelectedAlbumDraft((current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                          placeholder="Album description"
                          value={selectedAlbumDraft.description}
                        />
                        <button
                          className="button-primary"
                          disabled={
                            pendingIntent === "update-album" &&
                            pendingAlbumId === selectedAlbumId
                          }
                          type="submit"
                        >
                          {pendingIntent === "update-album" &&
                          pendingAlbumId === selectedAlbumId
                            ? "Saving..."
                            : "Save album"}
                        </button>
                      </Form>

                      <Form method="post">
                        <input
                          name="intent"
                          type="hidden"
                          value="delete-album"
                        />
                        <input
                          name="albumId"
                          type="hidden"
                          value={selectedAlbumId ?? ""}
                        />
                        <button
                          className="button-secondary"
                          disabled={
                            pendingIntent === "delete-album" &&
                            pendingAlbumId === selectedAlbumId
                          }
                          type="submit"
                        >
                          {pendingIntent === "delete-album" &&
                          pendingAlbumId === selectedAlbumId
                            ? "Deleting..."
                            : "Delete album"}
                        </button>
                      </Form>
                    </div>

                    <Form className="space-y-3" method="post">
                      <input
                        name="intent"
                        type="hidden"
                        value="add-album-photo"
                      />
                      <input
                        name="albumId"
                        type="hidden"
                        value={selectedAlbumId ?? ""}
                      />
                      <select
                        aria-label="Photo for album"
                        className="field"
                        disabled={
                          isLibraryPhotosLoading ||
                          availableLibraryPhotos.length === 0
                        }
                        name="photoId"
                        onChange={(event) => {
                          setAlbumPhotoDraft(event.target.value);
                        }}
                        value={albumPhotoDraft}
                      >
                        <option value="">
                          {isLibraryPhotosLoading
                            ? "Loading your photos..."
                            : "Select one of your photos"}
                        </option>
                        {availableLibraryPhotos.map((photo) => (
                          <option key={photo.id} value={photo.id}>
                            {photo.originalFilename}
                          </option>
                        ))}
                      </select>
                      {libraryPhotosError ? (
                        <p className="text-sm text-[var(--color-danger-strong)]">
                          {libraryPhotosError}
                        </p>
                      ) : null}
                      {!isLibraryPhotosLoading &&
                      !libraryPhotosError &&
                      availableLibraryPhotos.length === 0 ? (
                        <p className="text-sm text-[var(--color-text-muted)]">
                          All available personal photos are already present in
                          this shared album.
                        </p>
                      ) : null}
                      <button
                        className="button-primary"
                        disabled={
                          !albumPhotoDraft ||
                          (pendingIntent === "add-album-photo" &&
                            pendingAlbumId === selectedAlbumId)
                        }
                        type="submit"
                      >
                        {pendingIntent === "add-album-photo" &&
                        pendingAlbumId === selectedAlbumId
                          ? "Adding..."
                          : "Add photo"}
                      </button>
                    </Form>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="eyebrow">Album photos</p>
                        <p className="text-sm text-[var(--color-text-muted)]">
                          {selectedAlbumPhotos.length} items
                        </p>
                      </div>
                      {selectedAlbumPhotos.length === 0 ? (
                        <p className="text-sm text-[var(--color-text-muted)]">
                          No photos in this album.
                        </p>
                      ) : (
                        selectedAlbumPhotos.map((photo) => (
                          <SurfaceCard
                            className="rounded-2xl p-4"
                            key={photo.id}
                            tone="subtle"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <Link
                                  className="link-accent text-base font-semibold tracking-tight"
                                  to={`/app/spaces/${spaceId}/albums/${selectedAlbumId}/photos/${photo.id}`}
                                >
                                  {photo.originalFilename}
                                </Link>
                                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                                  Added from uploader {photo.uploaderId}
                                </p>
                                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                                  {photo.width && photo.height
                                    ? `${photo.width} × ${photo.height}`
                                    : "Unknown size"}{" "}
                                  · {Math.round(photo.sizeBytes / 1024)} KB ·{" "}
                                  {formatDateTime(photo.createdAt)}
                                </p>
                              </div>
                              <div className="flex flex-col gap-2 sm:items-end">
                                <Link
                                  className="button-secondary"
                                  to={`/app/spaces/${spaceId}/albums/${selectedAlbumId}/photos/${photo.id}`}
                                >
                                  Preview
                                </Link>
                                <Form method="post">
                                  <input
                                    name="intent"
                                    type="hidden"
                                    value="remove-album-photo"
                                  />
                                  <input
                                    name="albumId"
                                    type="hidden"
                                    value={selectedAlbumId ?? ""}
                                  />
                                  <input
                                    name="photoId"
                                    type="hidden"
                                    value={photo.id}
                                  />
                                  <button
                                    className="button-secondary"
                                    disabled={
                                      pendingIntent === "remove-album-photo" &&
                                      pendingAlbumId === selectedAlbumId &&
                                      pendingPhotoId === photo.id
                                    }
                                    type="submit"
                                  >
                                    {pendingIntent === "remove-album-photo" &&
                                    pendingAlbumId === selectedAlbumId &&
                                    pendingPhotoId === photo.id
                                      ? "Removing..."
                                      : `Remove ${photo.originalFilename}`}
                                  </button>
                                </Form>
                              </div>
                            </div>
                          </SurfaceCard>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Create a Space album or select an existing one to manage
                    shared photos.
                  </p>
                )}
              </SurfaceCard>
            </div>
          </Panel>
        </div>

        <Panel className="p-6">
          <p className="eyebrow">Invites</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Join flows
          </h2>

          {inviteError ? (
            <InlineMessage className="mt-4" tone="danger">
              {inviteError}
            </InlineMessage>
          ) : null}

          <Form className="mt-5 space-y-3" method="post">
            <input name="intent" type="hidden" value="create-invite" />
            <select
              aria-label="Invite default role"
              className="field"
              name="defaultRole"
              onChange={(event) =>
                setInviteDraft((current) => ({
                  ...current,
                  defaultRole: event.target.value as SpaceRole,
                }))
              }
              value={inviteDraft.defaultRole}
            >
              <option value="VIEWER">Viewer</option>
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
            <input
              className="field"
              name="expiration"
              onChange={(event) =>
                setInviteDraft((current) => ({
                  ...current,
                  expiration: event.target.value,
                }))
              }
              type="datetime-local"
              value={inviteDraft.expiration}
            />
            <input
              className="field"
              min="1"
              name="usageLimit"
              onChange={(event) =>
                setInviteDraft((current) => ({
                  ...current,
                  usageLimit: event.target.value,
                }))
              }
              placeholder="Usage limit"
              type="number"
              value={inviteDraft.usageLimit}
            />
            <button
              className="button-primary w-full"
              disabled={pendingIntent === "create-invite"}
              type="submit"
            >
              {pendingIntent === "create-invite"
                ? "Creating..."
                : "Create invite"}
            </button>
          </Form>

          <div className="mt-6 space-y-3">
            {state.invites.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                No active invites.
              </p>
            ) : filteredInvites.length === 0 ? (
              <EmptyHint>No invites match the current filter.</EmptyHint>
            ) : (
              filteredInvites.map((invite) => (
                <SurfaceCard className="rounded-2xl p-4" key={invite.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="eyebrow">Invite code</p>
                      <h3 className="mt-1 break-all text-lg font-semibold tracking-tight">
                        {invite.code}
                      </h3>
                    </div>
                    <Form method="post">
                      <input
                        name="intent"
                        type="hidden"
                        value="revoke-invite"
                      />
                      <input name="inviteId" type="hidden" value={invite.id} />
                      <button
                        className="text-link-danger text-sm font-semibold"
                        disabled={
                          pendingIntent === "revoke-invite" &&
                          pendingInviteId === invite.id
                        }
                        type="submit"
                      >
                        {pendingIntent === "revoke-invite" &&
                        pendingInviteId === invite.id
                          ? "Revoking..."
                          : "Revoke"}
                      </button>
                    </Form>
                  </div>
                  <dl className="mt-4 space-y-2 text-sm text-[var(--color-text-muted)]">
                    <div className="flex justify-between gap-4">
                      <dt>Default role</dt>
                      <dd>{invite.defaultRole}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>Usage</dt>
                      <dd>
                        {invite.usageCount}
                        {invite.usageLimit ? ` / ${invite.usageLimit}` : ""}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>Expiration</dt>
                      <dd>{formatDateTime(invite.expiration)}</dd>
                    </div>
                  </dl>
                  <Link
                    className="button-secondary mt-4 w-full"
                    to={`/join/${invite.code}`}
                  >
                    Open join page
                  </Link>
                </SurfaceCard>
              ))
            )}
          </div>
        </Panel>
      </section>
    </div>
  );
}
