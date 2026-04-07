import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { Route } from "./+types/app-photo-detail";
import { InlineMessage, Panel, SurfaceCard } from "~/components/ui";
import {
  ApiError,
  addFavorite,
  deletePhoto,
  getPhoto,
  getPhotoBlob,
  listFavorites,
  removeFavorite,
} from "~/lib/api";
import { formatBytes, formatDateTime } from "~/lib/format";
import { getActiveLocale, translateMessage, useI18n } from "~/lib/i18n";
import type { FavoriteDto, PhotoDto } from "~/types/api";

interface PhotoDetailLoaderData {
  photo: PhotoDto;
  favorite: FavoriteDto | null;
  photoId: string;
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const photoId = params.photoId ?? "";
  const [photo, favorites] = await Promise.all([
    getPhoto(photoId),
    listFavorites("PHOTO"),
  ]);

  return {
    photo,
    favorite: favorites.find((item) => item.targetId === photoId) ?? null,
    photoId,
  } satisfies PhotoDetailLoaderData;
}

export default function AppPhotoDetailRoute({
  loaderData,
}: Route.ComponentProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const params = useParams();
  const photoId = loaderData.photoId || params.photoId || "";
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [favorite, setFavorite] = useState<FavoriteDto | null>(
    loaderData.favorite,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDownloadingOriginal, setIsDownloadingOriginal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFavoriteBusy, setIsFavoriteBusy] = useState(false);
  const photo = loaderData.photo;

  useEffect(() => {
    setFavorite(loaderData.favorite);
  }, [loaderData.favorite]);

  useEffect(() => {
    if (!photoId) {
      return;
    }

    setErrorMessage(null);
    let isCancelled = false;
    let objectUrl: string | null = null;

    getPhotoBlob(photoId)
      .then((blob) => {
        if (isCancelled) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : t("app.photoDetail.loadFailed"),
          );
        }
      });

    return () => {
      isCancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [photoId, t]);

  async function handleDeletePhoto() {
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await deletePhoto(photoId);
      navigate("/app/library", { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t("app.photoDetail.deleteFailed"));
      }
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleFavoriteToggle() {
    setIsFavoriteBusy(true);
    setErrorMessage(null);

    try {
      if (favorite) {
        await removeFavorite(favorite.id);
        setFavorite(null);
      } else {
        await addFavorite("PHOTO", photoId);
        const favorites = await listFavorites("PHOTO");
        setFavorite(
          favorites.find((item) => item.targetId === photoId) ?? null,
        );
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t("app.photoDetail.favoriteFailed"));
      }
    } finally {
      setIsFavoriteBusy(false);
    }
  }

  async function handleDownloadOriginal() {
    setIsDownloadingOriginal(true);
    setErrorMessage(null);

    try {
      const blob = await getPhotoBlob(photoId, "ORIGINAL");
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download =
        photo?.originalFilename ??
        translateMessage(getActiveLocale(), "app.photoDetail.loadingTitle");
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t("app.photoDetail.downloadFailed"));
      }
    } finally {
      setIsDownloadingOriginal(false);
    }
  }

  if (!photoId) {
    return (
      <Panel className="p-6">
        <p className="text-sm text-[var(--color-danger-strong)]">
          {t("app.photoDetail.missingId")}
        </p>
      </Panel>
    );
  }

  const capturedAt = photo?.takenAt ?? photo?.createdAt ?? null;
  const hasCoordinates = photo?.latitude != null && photo?.longitude != null;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">{t("app.photoDetail.eyebrow")}</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            {photo?.originalFilename ?? t("app.photoDetail.loadingTitle")}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--color-text-muted)]">
            {t("app.photoDetail.description")}
          </p>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">
            {capturedAt
              ? formatDateTime(capturedAt)
              : t("app.photoDetail.capturePending")}{" "}
            ·{" "}
            {photo
              ? `${photo.width ?? "?"}x${photo.height ?? "?"}`
              : t("app.photoDetail.dimensionsPending")}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
          <Link className="button-secondary w-full sm:w-auto" to="/app/library">
            {t("app.photoDetail.backToLibrary")}
          </Link>
          <button
            className="button-secondary w-full sm:w-auto"
            disabled={isFavoriteBusy}
            onClick={() => {
              void handleFavoriteToggle();
            }}
            type="button"
          >
            {isFavoriteBusy
              ? t("common.updating")
              : favorite
                ? t("app.photoDetail.removeFavorite")
                : t("app.photoDetail.addFavorite")}
          </button>
          <button
            className="button-secondary w-full sm:w-auto"
            disabled={isDeleting}
            onClick={() => {
              void handleDeletePhoto();
            }}
            type="button"
          >
            {isDeleting
              ? t("common.deleting")
              : t("app.photoDetail.deletePhoto")}
          </button>
          <Link
            className="button-secondary w-full sm:w-auto"
            to="/app/favorites"
          >
            {t("app.photoDetail.openFavorites")}
          </Link>
          <button
            className="button-primary w-full sm:w-auto"
            disabled={isDownloadingOriginal}
            onClick={() => {
              void handleDownloadOriginal();
            }}
            type="button"
          >
            {isDownloadingOriginal
              ? t("common.loading")
              : t("app.photoDetail.downloadOriginal")}
          </button>
        </div>
      </header>

      {errorMessage ? (
        <Panel className="p-4">
          <InlineMessage tone="danger">{errorMessage}</InlineMessage>
        </Panel>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_0.65fr]">
        <Panel className="preview-frame overflow-hidden p-3">
          <div className="preview-image relative flex min-h-[20rem] items-center justify-center rounded-[1.25rem] p-4 sm:min-h-[30rem] xl:min-h-[42rem]">
            {imageUrl ? (
              <img
                alt={photo?.originalFilename ?? t("app.photoDetail.previewAlt")}
                className="h-full max-h-[40rem] w-full max-w-full object-contain"
                src={imageUrl}
              />
            ) : (
              <div className="preview-placeholder flex min-h-[20rem] w-full items-center justify-center rounded-[1.25rem] text-sm sm:min-h-[30rem] xl:min-h-[42rem]">
                {t("common.loadingPreview")}
              </div>
            )}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel className="p-5">
            <p className="eyebrow">
              {t("app.photoDetail.photoActionsEyebrow")}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {t("app.photoDetail.photoActionsTitle")}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
              {t("app.photoDetail.photoActionsDescription")}
            </p>

            <dl className="mt-5 space-y-3 text-sm text-[var(--color-text-muted)]">
              <div className="flex items-center justify-between gap-4">
                <dt>{t("app.photoDetail.status")}</dt>
                <dd>
                  {favorite
                    ? t("app.photoDetail.statusSaved")
                    : t("app.photoDetail.statusLibrary")}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt>{t("app.photoDetail.variants")}</dt>
                <dd>{photo?.variants.length ?? 0}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt>{t("app.photoDetail.originalFileSize")}</dt>
                <dd>
                  {photo ? formatBytes(photo.sizeBytes) : t("common.loading")}
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel className="p-5">
            <p className="eyebrow">{t("app.photoDetail.metadataEyebrow")}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {t("app.photoDetail.metadataTitle")}
            </h2>
            <dl className="mt-5 space-y-3 text-sm text-[var(--color-text-muted)]">
              <div className="flex justify-between gap-4">
                <dt>{t("app.photoDetail.mimeType")}</dt>
                <dd>{photo?.mimeType ?? t("common.loading")}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>{t("app.photoDetail.dimensions")}</dt>
                <dd>
                  {photo
                    ? `${photo.width ?? "?"}x${photo.height ?? "?"}`
                    : t("common.loading")}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>{t("app.photoDetail.takenAt")}</dt>
                <dd>{formatDateTime(photo?.takenAt ?? null)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>{t("app.photoDetail.added")}</dt>
                <dd>{formatDateTime(photo?.createdAt ?? null)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>{t("app.photoDetail.coordinates")}</dt>
                <dd>
                  {hasCoordinates
                    ? `${photo?.latitude?.toFixed(4)}, ${photo?.longitude?.toFixed(4)}`
                    : t("common.notAvailable")}
                </dd>
              </div>
            </dl>
          </Panel>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.72fr_0.28fr]">
        <Panel className="p-6">
          <p className="eyebrow">
            {t("app.photoDetail.metadataPayloadEyebrow")}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {t("app.photoDetail.metadataPayloadTitle")}
          </h2>
          <pre className="mt-5 max-h-80 overflow-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 text-xs leading-6 text-[var(--color-text-muted)] whitespace-pre-wrap">
            {photo?.exifData || t("app.photoDetail.noExif")}
          </pre>
        </Panel>

        <SurfaceCard className="rounded-3xl p-5" tone="subtle">
          <p className="eyebrow">{t("app.photoDetail.tagsEyebrow")}</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            {t("app.photoDetail.tagsTitle")}
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
            {t("app.photoDetail.tagsDescription")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="badge-neutral rounded-full px-3 py-1 text-xs font-semibold">
              {favorite
                ? t("app.photoDetail.badgeSaved")
                : t("app.photoDetail.badgeLibrary")}
            </span>
            <span className="badge-neutral rounded-full px-3 py-1 text-xs font-semibold">
              {photo?.mimeType ?? t("app.photoDetail.badgeUnknown")}
            </span>
            {hasCoordinates ? (
              <span className="badge-neutral rounded-full px-3 py-1 text-xs font-semibold">
                {t("app.photoDetail.badgeGeotagged")}
              </span>
            ) : null}
          </div>
        </SurfaceCard>
      </section>
    </div>
  );
}
