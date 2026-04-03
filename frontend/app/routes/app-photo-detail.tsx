import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { Route } from "./+types/app-photo-detail";
import { Panel } from "~/components/ui";
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
  const navigate = useNavigate();
  const params = useParams();
  const photoId = loaderData.photoId || params.photoId || "";
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [favorite, setFavorite] = useState<FavoriteDto | null>(
    loaderData.favorite,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
            error instanceof Error ? error.message : "Failed to load photo.",
          );
        }
      });

    return () => {
      isCancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [photoId]);

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
        setErrorMessage("Failed to delete photo.");
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
        setErrorMessage("Failed to update favorite.");
      }
    } finally {
      setIsFavoriteBusy(false);
    }
  }

  if (!photoId) {
    return (
      <Panel className="p-6">
        <p className="text-sm text-[var(--color-danger)]">
          Photo id is missing.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Photo Viewer</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            {photo?.originalFilename ?? "Loading photo"}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--color-text-muted)]">
            Full-size preview, metadata, and favorite state for a personal photo
            asset.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {imageUrl ? (
            <a
              className="button-secondary w-full sm:w-auto"
              download={photo?.originalFilename ?? "photo.jpg"}
              href={imageUrl}
            >
              Download preview
            </a>
          ) : null}
          <button
            className="button-secondary w-full sm:w-auto"
            disabled={isFavoriteBusy}
            onClick={() => {
              void handleFavoriteToggle();
            }}
            type="button"
          >
            {isFavoriteBusy
              ? "Updating..."
              : favorite
                ? "Remove favorite"
                : "Add favorite"}
          </button>
          <button
            className="button-secondary w-full sm:w-auto"
            disabled={isDeleting}
            onClick={() => {
              void handleDeletePhoto();
            }}
            type="button"
          >
            {isDeleting ? "Deleting..." : "Delete photo"}
          </button>
          <Link
            className="button-secondary w-full sm:w-auto"
            to="/app/favorites"
          >
            Open favorites
          </Link>
          <Link className="button-primary w-full sm:w-auto" to="/app/library">
            Back to library
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
          <p className="eyebrow">Favorite state</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">
            {favorite ? "Saved" : "Not saved"}
          </p>
        </Panel>
        <Panel className="p-5">
          <p className="eyebrow">Variants</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">
            {photo?.variants.length ?? 0}
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
              alt={photo?.originalFilename ?? "Photo preview"}
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
            Asset details
          </h2>
          <dl className="mt-5 space-y-3 text-sm text-[var(--color-text-muted)]">
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
              <dt>Taken at</dt>
              <dd>{formatDateTime(photo?.takenAt ?? null)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Created at</dt>
              <dd>{formatDateTime(photo?.createdAt ?? null)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Variants</dt>
              <dd>{photo?.variants.length ?? 0}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Favorite</dt>
              <dd>{favorite ? "Yes" : "No"}</dd>
            </div>
          </dl>

          <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel-strong)] p-4">
            <p className="eyebrow">EXIF payload</p>
            <pre className="mt-3 max-h-64 overflow-auto text-xs leading-6 text-[var(--color-text-muted)] whitespace-pre-wrap">
              {photo?.exifData || "No EXIF metadata available"}
            </pre>
          </div>
        </Panel>
      </section>
    </div>
  );
}
