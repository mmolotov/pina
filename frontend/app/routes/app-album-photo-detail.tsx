import type { Route } from "./+types/app-album-photo-detail";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { InlineMessage, PageHeader, Panel, SurfaceCard } from "~/components/ui";
import { getPhotoBlob, listAllAlbumPhotos, listAlbums } from "~/lib/api";
import { formatBytes, formatDateTime } from "~/lib/format";
import { useI18n } from "~/lib/i18n";
import type { AlbumDto, PhotoDto } from "~/types/api";

interface AlbumPhotoDetailLoaderData {
  album: AlbumDto | null;
  photo: PhotoDto | null;
  albumId: string;
  photoId: string;
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const albumId = params.albumId ?? "";
  const photoId = params.photoId ?? "";

  const [albums, photos] = await Promise.all([
    listAlbums(),
    listAllAlbumPhotos(albumId),
  ]);

  return {
    album: albums.find((album) => album.id === albumId) ?? null,
    photo: photos.find((photo) => photo.id === photoId) ?? null,
    albumId,
    photoId,
  } satisfies AlbumPhotoDetailLoaderData;
}

export default function AppAlbumPhotoDetailRoute({
  loaderData,
}: Route.ComponentProps) {
  const { t } = useI18n();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loaderData.photoId) {
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setErrorMessage(null);

    getPhotoBlob(loaderData.photoId)
      .then((blob) => {
        if (cancelled) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : t("app.albumPhotoDetail.loadFailed"),
          );
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [loaderData.photoId, t]);

  if (!loaderData.albumId || !loaderData.photoId) {
    return (
      <Panel className="p-6">
        <p className="text-sm text-[var(--color-danger-strong)]">
          {t("app.albumPhotoDetail.missingId")}
        </p>
      </Panel>
    );
  }

  if (!loaderData.album || !loaderData.photo) {
    return (
      <Panel className="p-6">
        <p className="text-sm text-[var(--color-danger-strong)]">
          {t("app.albumPhotoDetail.notFound")}
        </p>
      </Panel>
    );
  }

  const photo = loaderData.photo;
  const album = loaderData.album;

  return (
    <div className="space-y-8">
      <PageHeader
        actions={
          <>
            <Link
              className="button-secondary"
              to={`/app/library/albums/${album.id}`}
            >
              {t("app.albumPhotoDetail.backToAlbum")}
            </Link>
            <Link className="button-secondary" to="/app/library?view=albums">
              {t("app.albumPhotoDetail.backToAlbums")}
            </Link>
          </>
        }
        description={t("app.albumPhotoDetail.description", {
          albumName: album.name,
        })}
        eyebrow={t("app.albumPhotoDetail.eyebrow")}
        title={photo.originalFilename}
      />

      {errorMessage ? <InlineMessage tone="danger">{errorMessage}</InlineMessage> : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_0.7fr]">
        <Panel className="preview-frame overflow-hidden p-3">
          {imageUrl ? (
            <img
              alt={t("app.albumPhotoDetail.previewAlt", {
                fileName: photo.originalFilename,
              })}
              className="preview-image h-full min-h-[20rem] w-full rounded-[1.25rem] object-contain sm:min-h-[30rem] xl:min-h-[42rem]"
              src={imageUrl}
            />
          ) : (
            <div className="preview-placeholder flex min-h-[20rem] items-center justify-center rounded-[1.25rem] text-sm sm:min-h-[30rem] xl:min-h-[42rem]">
              {t("common.loadingPreview")}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel className="p-5">
            <p className="eyebrow">{t("app.albumPhotoDetail.contextEyebrow")}</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">
              {album.name}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
              {album.description || t("app.albumPhotoDetail.noAlbumDescription")}
            </p>
          </Panel>

          <Panel className="p-5">
            <p className="eyebrow">{t("app.albumPhotoDetail.metadataEyebrow")}</p>
            <dl className="mt-4 space-y-3 text-sm text-[var(--color-text-muted)]">
              <div className="flex justify-between gap-4">
                <dt>{t("app.albumPhotoDetail.mimeType")}</dt>
                <dd>{photo.mimeType}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>{t("app.albumPhotoDetail.dimensions")}</dt>
                <dd>{`${photo.width ?? "?"}x${photo.height ?? "?"}`}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>{t("app.albumPhotoDetail.size")}</dt>
                <dd>{formatBytes(photo.sizeBytes)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>{t("app.albumPhotoDetail.takenAt")}</dt>
                <dd>{formatDateTime(photo.takenAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>{t("app.albumPhotoDetail.added")}</dt>
                <dd>{formatDateTime(photo.createdAt)}</dd>
              </div>
            </dl>
          </Panel>

          <SurfaceCard className="rounded-[1.5rem] p-5" tone="subtle">
            <p className="eyebrow">{t("app.albumPhotoDetail.metadataPayloadEyebrow")}</p>
            <pre className="mt-3 max-h-64 overflow-auto text-xs leading-6 whitespace-pre-wrap text-[var(--color-text-muted)]">
              {photo.exifData || t("app.albumPhotoDetail.noExif")}
            </pre>
          </SurfaceCard>
        </div>
      </section>
    </div>
  );
}
