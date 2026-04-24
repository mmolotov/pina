import type { Route } from "./+types/app-album-detail";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Form,
  Link,
  useActionData,
  useNavigate,
  useNavigation,
} from "react-router";
import { ProportionalTimelineRail } from "~/components/proportional-timeline-rail";
import {
  EmptyHint,
  EmptyState,
  InlineMessage,
  PageHeader,
  Panel,
  SurfaceCard,
} from "~/components/ui";
import { AlbumShareDialog } from "~/components/album-share-dialog";
import {
  addFavorite,
  addPhotoToAlbum,
  clearAlbumCover,
  createAlbumArchiveDownloadUrl,
  createAlbumShareLink,
  deleteAlbum,
  getAlbum,
  getPhotoBlob,
  listAllAlbumPhotos,
  listAlbumShareLinks,
  listFavorites,
  listPhotos,
  removeFavorite,
  revokeAlbumShareLink,
  setAlbumCover,
  removePhotoFromAlbum,
  updateAlbum,
  uploadPhoto,
} from "~/lib/api";
import {
  formatBytes,
  formatDateRange,
  formatDateTime,
  formatRelativeCount,
} from "~/lib/format";
import { getActiveLocale, translateMessage, useI18n } from "~/lib/i18n";
import { resolveActionIntent, toActionErrorMessage } from "~/lib/route-actions";
import {
  buildDaySectionId,
  buildProportionalTimeline,
  buildTimelineGroups,
  formatDayLabel,
} from "~/lib/timeline";
import type {
  AlbumDto,
  AlbumShareLinkDto,
  FavoriteDto,
  PhotoDto,
} from "~/types/api";

interface AlbumDetailLoaderData {
  album: AlbumDto | null;
  photos: PhotoDto[];
  libraryPhotos: PhotoDto[];
  libraryPhotosHasNext: boolean;
  favorite: FavoriteDto | null;
  albumId: string;
}

type AlbumDetailActionResult =
  | {
      ok: true;
      intent:
        | "update-album"
        | "delete-album"
        | "add-photo-to-album"
        | "remove-photo-from-album";
    }
  | {
      ok: false;
      intent:
        | "update-album"
        | "delete-album"
        | "add-photo-to-album"
        | "remove-photo-from-album";
      errorMessage: string;
    };

interface RelativeCountForms {
  one: string;
  few: string;
  many: string;
  other: string;
}

const ALBUM_DETAIL_LIBRARY_PICKER_PAGE_SIZE = 100;

async function loadAlbumDetailData(
  albumId: string,
): Promise<AlbumDetailLoaderData> {
  const [album, photos, libraryPhotosPage, favorites] = await Promise.all([
    getAlbum(albumId).catch(() => null),
    listAllAlbumPhotos(albumId),
    listPhotos(0, ALBUM_DETAIL_LIBRARY_PICKER_PAGE_SIZE),
    listFavorites("ALBUM"),
  ]);

  return {
    album,
    photos,
    libraryPhotos: libraryPhotosPage.items,
    libraryPhotosHasNext: libraryPhotosPage.hasNext,
    favorite:
      favorites.find((favorite) => favorite.targetId === albumId) ?? null,
    albumId,
  };
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const albumId = params.albumId ?? "";
  return loadAlbumDetailData(albumId);
}

export async function clientAction({
  request,
  params,
}: Route.ClientActionArgs): Promise<AlbumDetailActionResult> {
  const albumId = params.albumId ?? "";
  const formData = await request.formData();
  const intent = resolveActionIntent(
    String(formData.get("intent") ?? ""),
    [
      "update-album",
      "delete-album",
      "add-photo-to-album",
      "remove-photo-from-album",
    ] as const,
    "update-album",
  );

  try {
    switch (intent) {
      case "update-album":
        await updateAlbum(albumId, {
          name: String(formData.get("name") ?? "").trim(),
          description: String(formData.get("description") ?? "").trim(),
        });
        return { ok: true, intent };
      case "delete-album":
        await deleteAlbum(albumId);
        return { ok: true, intent };
      case "add-photo-to-album":
        await addPhotoToAlbum(albumId, String(formData.get("photoId") ?? ""));
        return { ok: true, intent };
      case "remove-photo-from-album":
        await removePhotoFromAlbum(
          albumId,
          String(formData.get("photoId") ?? ""),
        );
        return { ok: true, intent };
      default:
        return {
          ok: false,
          intent: "update-album",
          errorMessage: translateMessage(
            getActiveLocale(),
            "app.albumDetail.actionUnknown",
          ),
        };
    }
  } catch (error) {
    return {
      ok: false,
      intent,
      errorMessage: toActionErrorMessage(
        error,
        translateMessage(getActiveLocale(), "app.albumDetail.actionFailed"),
      ),
    };
  }
}

function getSupportedUploadFiles(files: Iterable<File>) {
  return Array.from(files).filter(
    (file) => file.type === "image/jpeg" || file.type === "image/png",
  );
}

function formatUploadSummary(
  uploadedCount: number,
  totalCount: number,
  locale: ReturnType<typeof useI18n>["locale"],
) {
  if (uploadedCount === totalCount) {
    return translateMessage(locale, "app.albumDetail.uploadSummaryFull", {
      count: new Intl.NumberFormat(locale).format(uploadedCount),
    });
  }

  return translateMessage(locale, "app.albumDetail.uploadSummaryPartial", {
    uploadedCount: new Intl.NumberFormat(locale).format(uploadedCount),
    totalCount: new Intl.NumberFormat(locale).format(totalCount),
  });
}

function triggerUrlDownload(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
}

function AlbumPhotoTile(props: {
  albumId: string;
  photo: PhotoDto;
  isCoverBusy: boolean;
  isCurrentCover: boolean;
  isRemoveBusy: boolean;
  onSetCover: () => void;
  removeLabel: string;
  coverLabel: string;
  setCoverLabel: string;
  photoForms: RelativeCountForms;
}) {
  const { t } = useI18n();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    getPhotoBlob(props.photo.id, "THUMB_SM")
      .then((blob) => {
        if (cancelled) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewUrl(null);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [props.photo.id]);

  return (
    <article className="group overflow-hidden rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="relative aspect-[4/3] overflow-hidden">
        <Link
          aria-label={t("app.library.photoTileAria", {
            fileName: props.photo.originalFilename,
          })}
          className="block h-full"
          to={`/app/library/albums/${props.albumId}/photos/${props.photo.id}`}
        >
          {previewUrl ? (
            <img
              alt={t("app.library.photoPreviewAlt", {
                fileName: props.photo.originalFilename,
              })}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
              src={previewUrl}
            />
          ) : (
            <div className="preview-placeholder flex h-full items-center justify-center px-4 text-center text-xs">
              {props.photo.originalFilename}
            </div>
          )}
        </Link>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-2 justify-end gap-2 bg-linear-to-t from-black/55 via-black/20 to-transparent p-3 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          <button
            className="pointer-events-auto rounded-full border border-white/25 bg-black/45 px-3 py-1 text-xs font-medium text-white"
            disabled={props.isCurrentCover || props.isCoverBusy}
            onClick={props.onSetCover}
            type="button"
          >
            {props.isCurrentCover
              ? props.coverLabel
              : props.isCoverBusy
                ? t("common.saving")
                : props.setCoverLabel}
          </button>
          <Form className="pointer-events-auto" method="post">
            <input
              name="intent"
              type="hidden"
              value="remove-photo-from-album"
            />
            <input name="photoId" type="hidden" value={props.photo.id} />
            <button
              className="rounded-full border border-white/25 bg-black/65 px-3 py-1 text-xs font-medium text-white"
              disabled={props.isRemoveBusy}
              type="submit"
            >
              {props.isRemoveBusy ? t("common.deleting") : props.removeLabel}
            </button>
          </Form>
        </div>
      </div>

      <div className="space-y-2 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <Link
            className="min-w-0 truncate text-sm font-semibold tracking-tight"
            to={`/app/library/albums/${props.albumId}/photos/${props.photo.id}`}
          >
            {props.photo.originalFilename}
          </Link>
          <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
            {formatBytes(props.photo.sizeBytes)}
          </span>
        </div>
        <p className="text-xs leading-5 text-[var(--color-text-muted)]">
          {formatDateTime(props.photo.takenAt ?? props.photo.createdAt)} ·{" "}
          {formatRelativeCount(1, props.photoForms)}
        </p>
      </div>
    </article>
  );
}

export default function AppAlbumDetailRoute({
  loaderData,
}: Route.ComponentProps) {
  const { locale, t } = useI18n();
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [album, setAlbum] = useState(loaderData.album);
  const [photos, setPhotos] = useState(loaderData.photos);
  const [libraryPhotos, setLibraryPhotos] = useState(loaderData.libraryPhotos);
  const [libraryPhotosHasNext, setLibraryPhotosHasNext] = useState(
    loaderData.libraryPhotosHasNext,
  );
  const [favorite, setFavorite] = useState(loaderData.favorite);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<
    string | null
  >(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState("");
  const [isFavoriteBusy, setIsFavoriteBusy] = useState(false);
  const [isAddPhotosOpen, setIsAddPhotosOpen] = useState(
    loaderData.photos.length === 0,
  );
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState({
    name: loaderData.album?.name ?? "",
    description: loaderData.album?.description ?? "",
  });
  const [uploadProgress, setUploadProgress] = useState<{
    total: number;
    completed: number;
    currentFileName: string | null;
  } | null>(null);
  const [isCoverBusy, setIsCoverBusy] = useState<string | null>(null);
  const [isClearingCover, setIsClearingCover] = useState(false);
  const [isDownloadingAlbum, setIsDownloadingAlbum] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareDialogLinks, setShareDialogLinks] = useState<AlbumShareLinkDto[]>(
    [],
  );
  const [shareDialogLoading, setShareDialogLoading] = useState(false);
  const [shareDialogCreating, setShareDialogCreating] = useState(false);
  const [shareDialogRevokeBusyId, setShareDialogRevokeBusyId] = useState<
    string | null
  >(null);
  const [shareDialogToken, setShareDialogToken] = useState<string | null>(null);
  const [shareDialogError, setShareDialogError] = useState<string | null>(null);
  const [shareDialogInfo, setShareDialogInfo] = useState<string | null>(null);
  const pendingIntent = String(navigation.formData?.get("intent") ?? "");
  const pendingPhotoId = String(navigation.formData?.get("photoId") ?? "");

  const photoForms = {
    one: t("unit.photo.one"),
    few: t("unit.photo.few"),
    many: t("unit.photo.many"),
    other: t("unit.photo.other"),
  };
  const timelineGroups = useMemo(() => buildTimelineGroups(photos), [photos]);
  const timelineMarkers = useMemo(
    () => buildProportionalTimeline(timelineGroups, locale),
    [locale, timelineGroups],
  );
  const availableLibraryPhotos = useMemo(
    () =>
      libraryPhotos.filter(
        (photo) => !photos.some((albumPhoto) => albumPhoto.id === photo.id),
      ),
    [libraryPhotos, photos],
  );
  const coverPhotoId = album?.coverPhotoId ?? photos[0]?.id ?? null;
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  const refreshAlbumDetail = useCallback(async () => {
    if (!loaderData.albumId) {
      return;
    }

    try {
      const nextData = await loadAlbumDetailData(loaderData.albumId);
      startTransition(() => {
        setAlbum(nextData.album);
        setPhotos(nextData.photos);
        setLibraryPhotos(nextData.libraryPhotos);
        setLibraryPhotosHasNext(nextData.libraryPhotosHasNext);
        setFavorite(nextData.favorite);
        setEditDraft({
          name: nextData.album?.name ?? "",
          description: nextData.album?.description ?? "",
        });
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("app.albumDetail.loadFailed"),
      );
    }
  }, [loaderData.albumId, t]);

  useEffect(() => {
    setAlbum(loaderData.album);
    setPhotos(loaderData.photos);
    setLibraryPhotos(loaderData.libraryPhotos);
    setLibraryPhotosHasNext(loaderData.libraryPhotosHasNext);
    setFavorite(loaderData.favorite);
    setEditDraft({
      name: loaderData.album?.name ?? "",
      description: loaderData.album?.description ?? "",
    });
  }, [loaderData]);

  useEffect(() => {
    if (!coverPhotoId) {
      setCoverUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    getPhotoBlob(coverPhotoId, "THUMB_SM")
      .then((blob) => {
        if (cancelled) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setCoverUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setCoverUrl(null);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [coverPhotoId]);

  useEffect(() => {
    if (!actionData) {
      return;
    }

    if (actionData.ok) {
      setErrorMessage(null);
      setSelectedPhotoId("");
      if (actionData.intent === "update-album") {
        setIsEditOpen(false);
      }
      if (actionData.intent === "delete-album") {
        navigate("/app/library?view=albums", { replace: true });
        return;
      }
      void refreshAlbumDetail();
      return;
    }

    setErrorMessage(actionData.errorMessage);
  }, [actionData, navigate, refreshAlbumDetail]);

  async function handleFavoriteToggle() {
    if (!loaderData.albumId) {
      return;
    }

    setIsFavoriteBusy(true);
    setErrorMessage(null);

    try {
      if (favorite) {
        await removeFavorite(favorite.id);
        setFavorite(null);
      } else {
        await addFavorite("ALBUM", loaderData.albumId);
        const favorites = await listFavorites("ALBUM");
        setFavorite(
          favorites.find((item) => item.targetId === loaderData.albumId) ??
            null,
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("app.albumDetail.favoriteFailed"),
      );
    } finally {
      setIsFavoriteBusy(false);
    }
  }

  async function handleUploadFiles(files: File[]) {
    const supportedFiles = getSupportedUploadFiles(files);
    if (supportedFiles.length === 0) {
      setUploadError(t("app.albumDetail.uploadTypeError"));
      setUploadSuccessMessage(null);
      return;
    }

    setUploadError(null);
    setUploadSuccessMessage(null);
    setUploadProgress({
      total: supportedFiles.length,
      completed: 0,
      currentFileName: supportedFiles[0]?.name ?? null,
    });

    let uploadedCount = 0;
    const failures: string[] = [];

    try {
      for (const [index, file] of supportedFiles.entries()) {
        setUploadProgress({
          total: supportedFiles.length,
          completed: uploadedCount,
          currentFileName: file.name,
        });

        try {
          const photo = await uploadPhoto(file);
          await addPhotoToAlbum(loaderData.albumId, photo.id);
          uploadedCount += 1;
        } catch (error) {
          failures.push(
            error instanceof Error
              ? `${file.name}: ${error.message}`
              : t("app.albumDetail.uploadFileFailed", { fileName: file.name }),
          );
        }

        setUploadProgress({
          total: supportedFiles.length,
          completed: uploadedCount,
          currentFileName:
            index < supportedFiles.length - 1
              ? supportedFiles[index + 1]!.name
              : null,
        });
      }

      if (uploadedCount > 0) {
        setUploadSuccessMessage(
          formatUploadSummary(uploadedCount, supportedFiles.length, locale),
        );
      }
      if (failures.length > 0) {
        setUploadError(failures.join(" "));
      }
      await refreshAlbumDetail();
    } finally {
      setUploadProgress(null);
    }
  }

  async function handleSetCover(photoId: string) {
    if (!loaderData.albumId) {
      return;
    }

    setIsCoverBusy(photoId);
    setErrorMessage(null);

    try {
      const updatedAlbum = await setAlbumCover(loaderData.albumId, photoId);
      setAlbum(updatedAlbum);
      await refreshAlbumDetail();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("app.albumDetail.setCoverFailed"),
      );
    } finally {
      setIsCoverBusy(null);
    }
  }

  async function handleClearCover() {
    if (!loaderData.albumId) {
      return;
    }

    setIsClearingCover(true);
    setErrorMessage(null);

    try {
      const updatedAlbum = await clearAlbumCover(loaderData.albumId);
      setAlbum(updatedAlbum);
      setIsEditOpen(false);
      await refreshAlbumDetail();
      setUploadSuccessMessage(t("app.albumDetail.automaticCoverRestored"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("app.albumDetail.clearCoverFailed"),
      );
    } finally {
      setIsClearingCover(false);
    }
  }

  async function handleDownloadAlbum() {
    if (!loaderData.albumId || !album) {
      return;
    }

    setIsDownloadingAlbum(true);
    setErrorMessage(null);

    try {
      const { url } = await createAlbumArchiveDownloadUrl(
        loaderData.albumId,
        "ORIGINAL",
      );
      triggerUrlDownload(url);
      setUploadSuccessMessage(
        t("app.albumDetail.downloadStarted", { albumName: album.name }),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("app.albumDetail.downloadFailed"),
      );
    } finally {
      setIsDownloadingAlbum(false);
    }
  }

  async function openShareDialog() {
    if (!loaderData.albumId) {
      return;
    }

    setShareDialogOpen(true);
    setShareDialogLoading(true);
    setShareDialogLinks([]);
    setShareDialogToken(null);
    setShareDialogError(null);
    setShareDialogInfo(null);

    try {
      const links = await listAlbumShareLinks(loaderData.albumId);
      setShareDialogLinks(links);
    } catch (error) {
      setShareDialogError(
        error instanceof Error ? error.message : t("app.albumShare.loadFailed"),
      );
    } finally {
      setShareDialogLoading(false);
    }
  }

  function closeShareDialog() {
    setShareDialogOpen(false);
    setShareDialogLoading(false);
    setShareDialogLinks([]);
    setShareDialogCreating(false);
    setShareDialogRevokeBusyId(null);
    setShareDialogToken(null);
    setShareDialogError(null);
    setShareDialogInfo(null);
  }

  async function copyShareText(
    value: string,
    successMessage: string,
    failureMessage: string,
  ) {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error(failureMessage);
      }

      await navigator.clipboard.writeText(value);
      setShareDialogError(null);
      setShareDialogInfo(successMessage);
    } catch (error) {
      setShareDialogError(
        error instanceof Error ? error.message : failureMessage,
      );
    }
  }

  async function handleCreateShareLink() {
    if (!loaderData.albumId || !album) {
      return;
    }

    setShareDialogCreating(true);
    setShareDialogError(null);
    setShareDialogInfo(null);

    try {
      const created = await createAlbumShareLink(loaderData.albumId);
      setShareDialogToken(created.token);
      setShareDialogLinks((current) => [created.link, ...current]);
      setShareDialogInfo(
        t("app.albumShare.createdSuccess", { albumName: album.name }),
      );
    } catch (error) {
      setShareDialogError(
        error instanceof Error
          ? error.message
          : t("app.albumShare.createFailed"),
      );
    } finally {
      setShareDialogCreating(false);
    }
  }

  async function handleRevokeShareLink(linkId: string) {
    if (!loaderData.albumId) {
      return;
    }

    setShareDialogRevokeBusyId(linkId);
    setShareDialogError(null);
    setShareDialogInfo(null);

    try {
      await revokeAlbumShareLink(loaderData.albumId, linkId);
      const links = await listAlbumShareLinks(loaderData.albumId);
      setShareDialogLinks(links);
      setShareDialogInfo(t("app.albumShare.revokedSuccess"));
    } catch (error) {
      setShareDialogError(
        error instanceof Error
          ? error.message
          : t("app.albumShare.revokeFailed"),
      );
    } finally {
      setShareDialogRevokeBusyId(null);
    }
  }

  if (!loaderData.albumId) {
    return (
      <Panel className="p-6">
        <p className="text-sm text-[var(--color-danger-strong)]">
          {t("app.albumDetail.missingId")}
        </p>
      </Panel>
    );
  }

  if (!album) {
    return (
      <EmptyState
        action={
          <Link className="button-secondary" to="/app/library?view=albums">
            {t("app.albumDetail.backToAlbums")}
          </Link>
        }
        description={t("app.albumDetail.notFoundDescription")}
        title={t("app.albumDetail.notFoundTitle")}
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        actions={
          <>
            <Link className="button-secondary" to="/app/library?view=albums">
              {t("app.albumDetail.backToAlbums")}
            </Link>
            <button
              className="button-secondary"
              onClick={() => {
                setIsAddPhotosOpen((current) => !current);
              }}
              type="button"
            >
              {t("app.albumDetail.addPhotos")}
            </button>
            <button
              className="button-secondary"
              onClick={() => {
                setIsEditOpen((current) => !current);
              }}
              type="button"
            >
              {t("app.albumDetail.editAlbum")}
            </button>
            <button
              className="button-secondary"
              disabled={isDownloadingAlbum}
              onClick={() => {
                void handleDownloadAlbum();
              }}
              type="button"
            >
              {isDownloadingAlbum
                ? t("common.loading")
                : t("app.albumDetail.downloadAlbum")}
            </button>
            <button
              className="button-secondary"
              onClick={() => {
                void openShareDialog();
              }}
              type="button"
            >
              {t("app.albumDetail.shareAlbum")}
            </button>
            <button
              className="button-secondary"
              disabled={isFavoriteBusy}
              onClick={() => {
                void handleFavoriteToggle();
              }}
              type="button"
            >
              {isFavoriteBusy
                ? t("common.updating")
                : favorite
                  ? t("common.unfavorite")
                  : t("common.favorite")}
            </button>
            <Form method="post">
              <input name="intent" type="hidden" value="delete-album" />
              <button
                className="button-secondary"
                disabled={pendingIntent === "delete-album"}
                type="submit"
              >
                {pendingIntent === "delete-album"
                  ? t("common.deleting")
                  : t("common.delete")}
              </button>
            </Form>
          </>
        }
        description={t("app.albumDetail.description")}
        eyebrow={t("app.albumDetail.eyebrow")}
        title={album.name}
      />

      {errorMessage ? (
        <InlineMessage tone="danger">{errorMessage}</InlineMessage>
      ) : null}
      {uploadError ? (
        <InlineMessage tone="danger">{uploadError}</InlineMessage>
      ) : null}
      {uploadSuccessMessage ? (
        <InlineMessage tone="success">{uploadSuccessMessage}</InlineMessage>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel className="overflow-hidden p-0">
          <div className="grid gap-0 lg:grid-cols-[0.72fr_1fr]">
            <div className="preview-frame min-h-[16rem] border-r-0 p-4 lg:min-h-full">
              {coverUrl ? (
                <img
                  alt={t("app.albumDetail.coverAlt", { albumName: album.name })}
                  className="h-full min-h-[14rem] w-full rounded-[1.4rem] object-cover"
                  src={coverUrl}
                />
              ) : (
                <div className="preview-placeholder flex h-full min-h-[14rem] items-center justify-center rounded-[1.4rem] px-6 text-center text-sm">
                  {t("app.albumDetail.noCover")}
                </div>
              )}
            </div>
            <div className="space-y-4 p-5">
              <div>
                <p className="eyebrow">{t("app.albumDetail.summaryEyebrow")}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  {album.name}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
                  {album.description || t("app.albumDetail.noDescription")}
                </p>
              </div>

              <dl className="grid gap-3 text-sm text-[var(--color-text-muted)] sm:grid-cols-2">
                <div>
                  <dt className="eyebrow">{t("app.albumDetail.itemCount")}</dt>
                  <dd className="mt-1 text-base font-medium text-[var(--color-text)]">
                    {formatRelativeCount(album.photoCount, photoForms)}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">{t("app.albumDetail.dateRange")}</dt>
                  <dd className="mt-1 text-base font-medium text-[var(--color-text)]">
                    {formatDateRange(
                      album.mediaRangeStart,
                      album.mediaRangeEnd,
                      locale,
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">{t("app.albumDetail.created")}</dt>
                  <dd className="mt-1 text-base font-medium text-[var(--color-text)]">
                    {formatDateTime(album.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">{t("app.albumDetail.updated")}</dt>
                  <dd className="mt-1 text-base font-medium text-[var(--color-text)]">
                    {formatDateTime(album.updatedAt)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </Panel>

        <div className="grid gap-4 md:grid-cols-3">
          <Panel className="p-4">
            <p className="eyebrow">{t("app.albumDetail.photosStat")}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {album.photoCount}
            </p>
          </Panel>
          <Panel className="p-4">
            <p className="eyebrow">{t("app.albumDetail.daysStat")}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {timelineGroups.length}
            </p>
          </Panel>
          <Panel className="p-4">
            <p className="eyebrow">{t("app.albumDetail.favoriteStat")}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {favorite
                ? t("app.albumDetail.favoriteSaved")
                : t("app.albumDetail.favoriteIdle")}
            </p>
          </Panel>
        </div>
      </section>

      {isEditOpen ? (
        <Panel className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">{t("app.albumDetail.editEyebrow")}</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">
                {t("app.albumDetail.editTitle")}
              </h2>
            </div>
            <button
              className="button-secondary"
              onClick={() => {
                setIsEditOpen(false);
                setEditDraft({
                  name: album.name,
                  description: album.description ?? "",
                });
              }}
              type="button"
            >
              {t("common.clear")}
            </button>
          </div>

          <Form
            className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_auto]"
            method="post"
          >
            <input name="intent" type="hidden" value="update-album" />
            <input
              className="field"
              name="name"
              onChange={(event) =>
                setEditDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              required
              value={editDraft.name}
            />
            <textarea
              className="field min-h-24 resize-y"
              name="description"
              onChange={(event) =>
                setEditDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              value={editDraft.description}
            />
            <button
              className="button-primary self-start"
              disabled={pendingIntent === "update-album"}
              type="submit"
            >
              {pendingIntent === "update-album"
                ? t("common.saving")
                : t("app.albumDetail.saveAlbum")}
            </button>
          </Form>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              className="button-secondary"
              disabled={album.coverPhotoId == null || isClearingCover}
              onClick={() => {
                void handleClearCover();
              }}
              type="button"
            >
              {isClearingCover
                ? t("common.saving")
                : t("app.albumDetail.useAutomaticCover")}
            </button>
          </div>
        </Panel>
      ) : null}

      {isAddPhotosOpen ? (
        <Panel className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">{t("app.albumDetail.addPhotosEyebrow")}</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">
                {t("app.albumDetail.addPhotosTitle")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
                {t("app.albumDetail.addPhotosDescription")}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <SurfaceCard className="rounded-[1.5rem] p-4">
              <p className="eyebrow">{t("app.albumDetail.uploadEyebrow")}</p>
              <label className="mt-3 block">
                <span className="mb-2 block text-sm font-medium">
                  {t("app.albumDetail.uploadLabel")}
                </span>
                <input
                  accept="image/jpeg,image/png"
                  className="field"
                  multiple
                  onChange={(event) => {
                    const files = event.target.files
                      ? Array.from(event.target.files)
                      : [];
                    if (files.length > 0) {
                      void handleUploadFiles(files);
                    }
                    event.target.value = "";
                  }}
                  type="file"
                />
              </label>

              {uploadProgress ? (
                <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                  {t("app.albumDetail.uploadingProgress", {
                    current: String(uploadProgress.completed),
                    total: String(uploadProgress.total),
                    fileName: uploadProgress.currentFileName ?? "",
                  })}
                </p>
              ) : null}
            </SurfaceCard>

            <SurfaceCard className="rounded-[1.5rem] p-4">
              <p className="eyebrow">
                {t("app.albumDetail.libraryPickerEyebrow")}
              </p>
              <Form className="mt-3 space-y-3" method="post">
                <input name="intent" type="hidden" value="add-photo-to-album" />
                <select
                  aria-label={t("app.albumDetail.existingPhotoLabel")}
                  className="field"
                  disabled={availableLibraryPhotos.length === 0}
                  name="photoId"
                  onChange={(event) => {
                    setSelectedPhotoId(event.target.value);
                  }}
                  value={selectedPhotoId}
                >
                  <option value="">{t("app.albumDetail.selectPhoto")}</option>
                  {availableLibraryPhotos.map((photo) => (
                    <option key={photo.id} value={photo.id}>
                      {photo.originalFilename}
                    </option>
                  ))}
                </select>
                {availableLibraryPhotos.length === 0 ? (
                  <EmptyHint>
                    {libraryPhotosHasNext
                      ? t("app.albumDetail.noAvailablePhotosWithinLimit", {
                          count: String(ALBUM_DETAIL_LIBRARY_PICKER_PAGE_SIZE),
                        })
                      : t("app.albumDetail.noAvailablePhotos")}
                  </EmptyHint>
                ) : null}
                {libraryPhotosHasNext ? (
                  <p className="text-xs leading-5 text-[var(--color-text-muted)]">
                    {t("app.albumDetail.libraryPickerLimitNotice", {
                      count: String(ALBUM_DETAIL_LIBRARY_PICKER_PAGE_SIZE),
                    })}
                  </p>
                ) : null}
                <button
                  className="button-primary"
                  disabled={
                    !selectedPhotoId || pendingIntent === "add-photo-to-album"
                  }
                  type="submit"
                >
                  {pendingIntent === "add-photo-to-album"
                    ? t("common.add")
                    : t("app.albumDetail.addSelectedPhoto")}
                </button>
              </Form>
            </SurfaceCard>
          </div>
        </Panel>
      ) : null}

      {photos.length === 0 ? (
        <EmptyState
          action={
            <button
              className="button-primary"
              onClick={() => {
                setIsAddPhotosOpen(true);
              }}
              type="button"
            >
              {t("app.albumDetail.addPhotos")}
            </button>
          }
          description={t("app.albumDetail.emptyDescription")}
          title={t("app.albumDetail.emptyTitle")}
        />
      ) : (
        <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="space-y-8">
            {timelineGroups.map((group) => (
              <section
                className="scroll-mt-16"
                id={buildDaySectionId(group.dayKey)}
                key={group.dayKey}
              >
                <div className="flex items-baseline justify-between gap-3 pb-3">
                  <h2 className="text-sm font-semibold">
                    {formatDayLabel(group.dayKey, locale)}
                  </h2>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {formatRelativeCount(group.photos.length, photoForms)}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                  {group.photos.map((photo) => (
                    <AlbumPhotoTile
                      albumId={loaderData.albumId}
                      coverLabel={t("app.albumDetail.currentCover")}
                      isCoverBusy={isCoverBusy === photo.id}
                      isCurrentCover={coverPhotoId === photo.id}
                      isRemoveBusy={
                        pendingIntent === "remove-photo-from-album" &&
                        pendingPhotoId === photo.id
                      }
                      key={photo.id}
                      onSetCover={() => {
                        void handleSetCover(photo.id);
                      }}
                      photo={photo}
                      photoForms={photoForms}
                      removeLabel={t("app.albumDetail.removePhoto")}
                      setCoverLabel={t("app.albumDetail.setAsCover")}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div
            className="hidden xl:block xl:sticky xl:self-start"
            style={{ top: "3.5rem" }}
          >
            <div style={{ height: "calc(100vh - 6rem)" }}>
              <ProportionalTimelineRail
                locale={locale}
                markers={timelineMarkers}
                timelineGroups={timelineGroups}
              />
            </div>
            <p className="mt-3 text-xs text-[var(--color-text-muted)]">
              {formatRelativeCount(album.photoCount, photoForms)} ·{" "}
              {timelineGroups.length} {t("app.albumDetail.dayGroups")}
            </p>
          </div>
        </section>
      )}

      {shareDialogOpen && album ? (
        <AlbumShareDialog
          albumName={album.name}
          createdToken={shareDialogToken}
          errorMessage={shareDialogError}
          infoMessage={shareDialogInfo}
          isCreating={shareDialogCreating}
          isLoading={shareDialogLoading}
          links={shareDialogLinks}
          onClose={closeShareDialog}
          onCopyLink={(url) => {
            void copyShareText(
              url,
              t("app.albumShare.linkCopied"),
              t("app.albumShare.copyLinkFailed"),
            );
          }}
          onCopyToken={(token) => {
            void copyShareText(
              token,
              t("app.albumShare.tokenCopied"),
              t("app.albumShare.copyTokenFailed"),
            );
          }}
          onCreate={() => {
            void handleCreateShareLink();
          }}
          onRevoke={(linkId) => {
            void handleRevokeShareLink(linkId);
          }}
          revokeBusyLinkId={shareDialogRevokeBusyId}
        />
      ) : null}
    </div>
  );
}
