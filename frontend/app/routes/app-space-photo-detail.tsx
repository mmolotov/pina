import type { Route } from "./+types/app-space-photo-detail";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Panel } from "~/components/ui";
import {
  getSpace,
  getSpaceAlbumPhotoBlob,
  listAllSpaceAlbumPhotos,
} from "~/lib/api";
import { formatBytes, formatDateTime } from "~/lib/format";
import type { PhotoDto, SpaceDto } from "~/types/api";

interface SpacePhotoDetailLoaderData {
  space: SpaceDto;
  photo: PhotoDto | null;
  spaceId: string;
  albumId: string;
  photoId: string;
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const spaceId = params.spaceId ?? "";
  const albumId = params.albumId ?? "";
  const photoId = params.photoId ?? "";

  const [space, page] = await Promise.all([
    getSpace(spaceId),
    listAllSpaceAlbumPhotos(spaceId, albumId),
  ]);

  return {
    space,
    photo: page.find((item) => item.id === photoId) ?? null,
    spaceId,
    albumId,
    photoId,
  } satisfies SpacePhotoDetailLoaderData;
}

export default function AppSpacePhotoDetailRoute({
  loaderData,
}: Route.ComponentProps) {
  const params = useParams();
  const spaceId = loaderData.spaceId || params.spaceId || "";
  const albumId = loaderData.albumId || params.albumId || "";
  const photoId = loaderData.photoId || params.photoId || "";
  const space: SpaceDto | null = loaderData.space;
  const photo: PhotoDto | null = loaderData.photo;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!spaceId || !albumId || !photoId) {
      return;
    }

    setErrorMessage(null);
    let isCancelled = false;
    let objectUrl: string | null = null;

    Promise.all([getSpaceAlbumPhotoBlob(spaceId, albumId, photoId)])
      .then(([blob]) => {
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
              : "Failed to load shared photo.",
          );
        }
      });

    return () => {
      isCancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [albumId, photoId, spaceId]);

  if (!spaceId || !albumId || !photoId) {
    return (
      <Panel className="p-6">
        <p className="text-sm text-[var(--color-danger)]">
          Space, album, or photo id is missing.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Shared Photo</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            {photo?.originalFilename ?? "Loading shared photo"}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--color-text-muted)]">
            Preview for a photo accessed through a Space album.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            className="button-secondary w-full sm:w-auto"
            to={`/app/spaces/${spaceId}`}
          >
            Space overview
          </Link>
          <Link
            className="button-primary w-full sm:w-auto"
            to={`/app/spaces/${spaceId}`}
          >
            Back to {space?.name ?? "Space"}
          </Link>
        </div>
      </header>

      {errorMessage ? (
        <Panel className="p-4">
          <p className="text-sm text-[var(--color-danger)]">{errorMessage}</p>
        </Panel>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <Panel className="p-5">
          <p className="eyebrow">Space</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">
            {space?.name ?? "Loading..."}
          </p>
        </Panel>
        <Panel className="p-5">
          <p className="eyebrow">Uploader</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">
            {photo?.uploaderId ?? "Loading..."}
          </p>
        </Panel>
        <Panel className="p-5">
          <p className="eyebrow">Size</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">
            {photo ? formatBytes(photo.sizeBytes) : "Loading..."}
          </p>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel className="overflow-hidden p-3">
          {imageUrl ? (
            <img
              alt={photo?.originalFilename ?? "Shared photo preview"}
              className="h-full min-h-[16rem] w-full rounded-[1.25rem] object-contain bg-[rgba(255,255,255,0.55)] sm:min-h-[22rem] xl:min-h-[26rem]"
              src={imageUrl}
            />
          ) : (
            <div className="flex min-h-[16rem] items-center justify-center rounded-[1.25rem] bg-[var(--color-panel-strong)] text-sm text-[var(--color-text-muted)] sm:min-h-[22rem] xl:min-h-[26rem]">
              Loading preview...
            </div>
          )}
        </Panel>

        <Panel className="p-6">
          <p className="eyebrow">Metadata</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Shared asset details
          </h2>
          <dl className="mt-5 space-y-3 text-sm text-[var(--color-text-muted)]">
            <div className="flex justify-between gap-4">
              <dt>Space</dt>
              <dd>{space?.name ?? "Loading..."}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Mime type</dt>
              <dd>{photo?.mimeType ?? "Loading..."}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Dimensions</dt>
              <dd>
                {photo
                  ? `${photo.width ?? "?"}x${photo.height ?? "?"}`
                  : "Loading..."}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Size</dt>
              <dd>{photo ? formatBytes(photo.sizeBytes) : "Loading..."}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Uploader</dt>
              <dd>{photo?.uploaderId ?? "Loading..."}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Taken at</dt>
              <dd>{formatDateTime(photo?.takenAt ?? null)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Added</dt>
              <dd>{formatDateTime(photo?.createdAt ?? null)}</dd>
            </div>
          </dl>

          <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel-strong)] p-4">
            <p className="eyebrow">EXIF payload</p>
            <pre className="mt-3 max-h-64 overflow-auto text-xs leading-6 whitespace-pre-wrap text-[var(--color-text-muted)]">
              {photo?.exifData || "No EXIF metadata available"}
            </pre>
          </div>
        </Panel>
      </section>
    </div>
  );
}
