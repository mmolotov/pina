import type { Route } from "./+types/app-space-album-detail";
import { useEffect, useMemo, useState } from "react";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
} from "react-router";
import { ChevronLeft, Image as ImageIcon, Trash2 } from "lucide-react";
import { ConfirmDialog } from "~/components/space-dialogs";
import {
  addPhotoToSpaceAlbum,
  ApiError,
  deleteSpaceAlbum,
  getSpace,
  listAllPhotos,
  listAllSpaceAlbumPhotos,
  listSpaceAlbums,
  removePhotoFromSpaceAlbum,
  updateSpaceAlbum,
} from "~/lib/api";
import { formatBytes, formatDateRange } from "~/lib/format";
import { getActiveLocale, translateMessage, useI18n } from "~/lib/i18n";
import { resolveActionIntent, toActionErrorMessage } from "~/lib/route-actions";
import { useSession } from "~/lib/session";
import type { AlbumDto, PhotoDto, SpaceDto, SpaceRole } from "~/types/api";

interface AlbumLoaderData {
  space: SpaceDto;
  album: AlbumDto | null;
  photos: PhotoDto[];
  spaceId: string;
  albumId: string;
}

const CONTRIBUTOR_ROLES: SpaceRole[] = ["OWNER", "ADMIN", "MEMBER"];

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const spaceId = params.spaceId ?? "";
  const albumId = params.albumId ?? "";
  const [space, albums] = await Promise.all([
    getSpace(spaceId),
    listSpaceAlbums(spaceId),
  ]);
  const album = albums.find((entry) => entry.id === albumId) ?? null;
  const photos = album ? await listAllSpaceAlbumPhotos(spaceId, albumId) : [];
  return { space, album, photos, spaceId, albumId } satisfies AlbumLoaderData;
}

type AlbumActionResult = { ok: true } | { ok: false; errorMessage: string };

export async function clientAction({
  request,
  params,
}: Route.ClientActionArgs): Promise<AlbumActionResult | Response> {
  const spaceId = params.spaceId ?? "";
  const albumId = params.albumId ?? "";
  const formData = await request.formData();
  const intent = resolveActionIntent(
    String(formData.get("intent") ?? ""),
    [
      "update-album",
      "delete-album",
      "add-album-photo",
      "remove-album-photo",
    ] as const,
    "update-album",
  );

  try {
    switch (intent) {
      case "update-album":
        await updateSpaceAlbum(spaceId, albumId, {
          name: String(formData.get("name") ?? "").trim(),
          description: String(formData.get("description") ?? "").trim(),
        });
        return { ok: true };
      case "delete-album":
        await deleteSpaceAlbum(spaceId, albumId);
        return redirect(`/app/spaces/${spaceId}`);
      case "add-album-photo":
        await addPhotoToSpaceAlbum(
          spaceId,
          albumId,
          String(formData.get("photoId") ?? ""),
        );
        return { ok: true };
      case "remove-album-photo":
        await removePhotoFromSpaceAlbum(
          spaceId,
          albumId,
          String(formData.get("photoId") ?? ""),
        );
        return { ok: true };
    }
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

export default function AppSpaceAlbumDetailRoute({
  loaderData,
}: Route.ComponentProps) {
  const { t, locale } = useI18n();
  const session = useSession();
  const currentUserId = session?.user.id ?? "";
  const navigation = useNavigation();
  const actionData = useActionData<typeof clientAction>();
  const { space, album, photos, spaceId, albumId } = loaderData;

  const [libraryPhotos, setLibraryPhotos] = useState<PhotoDto[] | null>(null);
  const [libraryError, setLibraryError] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState({
    name: album?.name ?? "",
    description: album?.description ?? "",
  });

  const role = space.myRole;
  const manage = role === "OWNER" || role === "ADMIN";
  const canContribute = role != null && CONTRIBUTOR_ROLES.includes(role);
  const canEditAlbum = Boolean(
    album && (manage || album.ownerId === currentUserId),
  );

  useEffect(() => {
    setDraft({
      name: album?.name ?? "",
      description: album?.description ?? "",
    });
  }, [album?.id, album?.name, album?.description]);

  useEffect(() => {
    if (!canContribute || libraryPhotos !== null) return;
    let cancelled = false;
    listAllPhotos()
      .then((items) => {
        if (!cancelled) setLibraryPhotos(items);
      })
      .catch((error) => {
        if (cancelled) return;
        setLibraryError(true);
        if (!(error instanceof ApiError)) setLibraryPhotos([]);
      });
    return () => {
      cancelled = true;
    };
  }, [canContribute, libraryPhotos]);

  const availablePhotos = useMemo(() => {
    const present = new Set(photos.map((photo) => photo.id));
    return (libraryPhotos ?? []).filter((photo) => !present.has(photo.id));
  }, [libraryPhotos, photos]);

  const isBusy = navigation.state !== "idle";
  const actionError =
    actionData && !actionData.ok ? actionData.errorMessage : null;

  if (!album) {
    return (
      <div className="spd-page">
        <Link
          className="spd-crumb spd-crumb-link"
          to={`/app/spaces/${spaceId}`}
        >
          <ChevronLeft size={14} />{" "}
          {t("app.spaceAlbum.backToSpace", { name: space.name })}
        </Link>
        <div className="inline-msg danger" role="alert">
          <span>{t("app.spaceAlbum.notFound")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="spd-page">
      <Link className="spd-crumb spd-crumb-link" to={`/app/spaces/${spaceId}`}>
        <ChevronLeft size={14} />{" "}
        {t("app.spaceAlbum.backToSpace", { name: space.name })}
      </Link>

      <div className="spd-sec-head">
        <div>
          <p className="eyebrow">{t("app.spaceAlbum.manageEyebrow")}</p>
          <h1 className="sp-head-title">{album.name}</h1>
          {album.description ? (
            <p className="spd-sec-sub">{album.description}</p>
          ) : null}
        </div>
        {canEditAlbum ? (
          <button
            className="text-link-danger"
            onClick={() => setConfirmDelete(true)}
            type="button"
          >
            {t("app.spaceAlbum.deleteAlbum")}
          </button>
        ) : null}
      </div>

      {actionError ? (
        <div className="inline-msg danger" role="alert">
          <span>{actionError}</span>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          {canEditAlbum ? (
            <Form
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
              method="post"
            >
              <input name="intent" type="hidden" value="update-album" />
              <p className="eyebrow">{t("app.spaceAlbum.manageEyebrow")}</p>
              <label className="mt-3 block">
                <span className="mb-1 block text-sm font-medium">
                  {t("common.name")}
                </span>
                <input
                  className="field"
                  name="name"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                  value={draft.name}
                />
              </label>
              <label className="mt-3 block">
                <span className="mb-1 block text-sm font-medium">
                  {t("common.description")}
                </span>
                <textarea
                  className="field min-h-20 resize-y"
                  name="description"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  value={draft.description}
                />
              </label>
              <button
                className="button-primary mt-4"
                disabled={isBusy}
                type="submit"
              >
                {isBusy ? t("common.saving") : t("app.spaceAlbum.save")}
              </button>
            </Form>
          ) : null}

          {canContribute ? (
            <Form
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
              method="post"
            >
              <input name="intent" type="hidden" value="add-album-photo" />
              <p className="eyebrow">{t("app.spaceAlbum.addTitle")}</p>
              <select
                aria-label={t("app.spaceAlbum.addTitle")}
                className="field mt-3"
                disabled={
                  libraryPhotos === null || availablePhotos.length === 0
                }
                name="photoId"
                onChange={(event) => setSelectedPhotoId(event.target.value)}
                value={selectedPhotoId}
              >
                <option value="">
                  {libraryPhotos === null
                    ? t("app.spaceAlbum.loadingPhotos")
                    : t("app.spaceAlbum.selectPhoto")}
                </option>
                {availablePhotos.map((photo) => (
                  <option key={photo.id} value={photo.id}>
                    {photo.originalFilename}
                  </option>
                ))}
              </select>
              {libraryError ? (
                <p className="mt-2 text-sm text-[var(--color-danger-strong)]">
                  {t("app.spaceAlbum.libraryError")}
                </p>
              ) : null}
              {libraryPhotos !== null &&
              !libraryError &&
              availablePhotos.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                  {t("app.spaceAlbum.allPresent")}
                </p>
              ) : null}
              <button
                className="button-primary mt-3"
                disabled={!selectedPhotoId || isBusy}
                type="submit"
              >
                {t("app.spaceAlbum.addCta")}
              </button>
            </Form>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">{t("app.spaceAlbum.photosTitle")}</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("app.spaceDetail.albumPhotoCount", { count: photos.length })}
            </p>
          </div>
          {photos.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("app.spaceAlbum.noPhotos")}
            </p>
          ) : (
            photos.map((photo) => {
              const canRemove =
                canEditAlbum || photo.uploaderId === currentUserId;
              return (
                <article
                  className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                  key={photo.id}
                >
                  <div className="min-w-0">
                    <Link
                      className="link-accent flex items-center gap-2 text-sm font-semibold tracking-tight"
                      to={`/app/spaces/${spaceId}/albums/${albumId}/photos/${photo.id}`}
                    >
                      <ImageIcon size={15} />
                      <span className="truncate">{photo.originalFilename}</span>
                    </Link>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {photo.width && photo.height
                        ? `${photo.width} × ${photo.height} · `
                        : ""}
                      {formatBytes(photo.sizeBytes)} ·{" "}
                      {formatDateRange(
                        photo.createdAt,
                        photo.createdAt,
                        locale,
                      )}
                    </p>
                  </div>
                  {canRemove ? (
                    <Form method="post">
                      <input
                        name="intent"
                        type="hidden"
                        value="remove-album-photo"
                      />
                      <input name="photoId" type="hidden" value={photo.id} />
                      <button
                        aria-label={t("common.remove")}
                        className="text-link-danger"
                        disabled={isBusy}
                        type="submit"
                      >
                        <Trash2 size={15} />
                      </button>
                    </Form>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </div>

      {confirmDelete ? (
        <ConfirmDialog
          body={t("app.spaceAlbum.deleteBody", { name: album.name })}
          confirmLabel={t("common.delete")}
          fields={{ intent: "delete-album" }}
          onClose={() => setConfirmDelete(false)}
          title={t("app.spaceAlbum.deleteTitle")}
        />
      ) : null}
    </div>
  );
}
