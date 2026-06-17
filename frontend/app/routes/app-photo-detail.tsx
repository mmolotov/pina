import { useEffect, useState } from "react";
import {
  useNavigate,
  useOutletContext,
  useRevalidator,
  useSearchParams,
} from "react-router";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  Trash2,
  X,
} from "lucide-react";
import type { Route } from "./+types/app-photo-detail";
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
import {
  getActiveLocale,
  type MessageKey,
  translateMessage,
  useI18n,
} from "~/lib/i18n";
import {
  getPhotoMediaKind,
  parseExifEntries,
  type MediaKind,
  type PhotoOverlayContext,
} from "~/lib/photo-media";
import type { FavoriteDto } from "~/types/api";

interface PhotoDetailLoaderData {
  photo: Awaited<ReturnType<typeof getPhoto>>;
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

const MEDIA_TYPE_LABEL: Record<MediaKind, MessageKey> = {
  photo: "app.library.mediaTypePhoto",
  video: "app.library.mediaTypeVideo",
  raw: "app.library.mediaTypeRaw",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="ph-lb-label">{label}</p>
      <div className="ph-lb-value">{children}</div>
    </div>
  );
}

export default function AppPhotoDetailRoute({
  loaderData,
}: Route.ComponentProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const revalidator = useRevalidator();
  const context = useOutletContext<PhotoOverlayContext | null>();

  const photo = loaderData.photo;
  const photoId = loaderData.photoId;
  const orderedIds = context?.orderedPhotoIds ?? [];
  const search = searchParams.toString();
  const suffix = search ? `?${search}` : "";

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [favorite, setFavorite] = useState<FavoriteDto | null>(
    loaderData.favorite,
  );
  const [tab, setTab] = useState<"info" | "exif">("info");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFavoriteBusy, setIsFavoriteBusy] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const index = orderedIds.indexOf(photoId);
  const count = orderedIds.length;
  const prevId =
    count > 0 && index >= 0 ? orderedIds[(index - 1 + count) % count] : null;
  const nextId =
    count > 0 && index >= 0 ? orderedIds[(index + 1) % count] : null;

  const closePath = `/app/library${suffix}`;
  const photoPath = (id: string) => `/app/library/photos/${id}${suffix}`;

  useEffect(() => {
    setFavorite(loaderData.favorite);
  }, [loaderData.favorite]);

  useEffect(() => {
    setTab("info");
    setErrorMessage(null);
    let cancelled = false;
    let objectUrl: string | null = null;

    setImageUrl(null);
    getPhotoBlob(photoId)
      .then((blob) => {
        if (cancelled) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage(t("app.library.lightbox.loadFailed"));
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [photoId, t]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        navigate(`/app/library${suffix}`);
      } else if (event.key === "ArrowLeft" && prevId) {
        navigate(`/app/library/photos/${prevId}${suffix}`, { replace: true });
      } else if (event.key === "ArrowRight" && nextId) {
        navigate(`/app/library/photos/${nextId}${suffix}`, { replace: true });
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navigate, suffix, prevId, nextId]);

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
      revalidator.revalidate();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : t("app.photoDetail.favoriteFailed"),
      );
    } finally {
      setIsFavoriteBusy(false);
    }
  }

  async function handleDownload() {
    setIsDownloading(true);
    setErrorMessage(null);
    try {
      const blob = await getPhotoBlob(photoId, "ORIGINAL");
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download =
        photo.originalFilename ??
        translateMessage(getActiveLocale(), "app.photoDetail.loadingTitle");
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : t("app.photoDetail.downloadFailed"),
      );
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await deletePhoto(photoId);
      navigate(closePath);
      revalidator.revalidate();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : t("app.photoDetail.deleteFailed"),
      );
      setIsDeleting(false);
    }
  }

  const kind = getPhotoMediaKind(photo);
  const capturedAt = photo.takenAt ?? photo.createdAt;
  const hasCoordinates = photo.latitude != null && photo.longitude != null;
  const exifEntries = parseExifEntries(photo.exifData);
  const placeholderRatio =
    photo.width && photo.height ? `${photo.width} / ${photo.height}` : "3 / 2";

  return (
    <div
      aria-label={photo.originalFilename}
      aria-modal="true"
      className="ph-lb"
      role="dialog"
    >
      <header className="ph-lb-top">
        <button
          aria-label={t("app.library.lightbox.close")}
          className="ph-lb-icon-btn"
          onClick={() => navigate(closePath)}
          type="button"
        >
          <X size={20} />
        </button>
        <div className="ph-lb-title">
          <p className="ph-lb-name">{photo.originalFilename}</p>
          <p className="ph-lb-meta">
            {formatDateTime(capturedAt)}
            {count > 0 && index >= 0 ? ` · ${index + 1} / ${count}` : ""}
          </p>
        </div>
        <div className="ph-lb-actions">
          <button
            className={`ph-lb-act ${favorite ? "is-on" : ""}`}
            disabled={isFavoriteBusy}
            onClick={() => {
              void handleFavoriteToggle();
            }}
            type="button"
          >
            <Heart fill={favorite ? "currentColor" : "none"} size={15} />
            <span>
              {favorite
                ? t("app.library.lightbox.favorited")
                : t("app.library.lightbox.favorite")}
            </span>
          </button>
          <button
            className="ph-lb-act"
            disabled={isDownloading}
            onClick={() => {
              void handleDownload();
            }}
            type="button"
          >
            <Download size={15} />
            <span>{t("app.library.lightbox.download")}</span>
          </button>
          <button
            className="ph-lb-act is-danger"
            disabled={isDeleting}
            onClick={() => {
              void handleDelete();
            }}
            type="button"
          >
            <Trash2 size={15} />
            <span>{t("app.library.lightbox.delete")}</span>
          </button>
        </div>
      </header>

      {errorMessage ? <p className="ph-lb-error">{errorMessage}</p> : null}

      <div className="ph-lb-stage">
        <button
          aria-label={t("app.library.lightbox.prev")}
          className="ph-lb-nav ph-lb-nav-l"
          disabled={!prevId}
          onClick={() =>
            prevId && navigate(photoPath(prevId), { replace: true })
          }
          style={{ opacity: prevId ? 1 : 0.3 }}
          type="button"
        >
          <ChevronLeft size={22} />
        </button>

        {imageUrl ? (
          <img
            alt={photo.originalFilename}
            className="ph-lb-image"
            src={imageUrl}
          />
        ) : (
          <div
            className="ph-lb-image-placeholder"
            style={{ aspectRatio: placeholderRatio }}
          >
            {t("common.loadingPreview")}
          </div>
        )}

        <button
          aria-label={t("app.library.lightbox.next")}
          className="ph-lb-nav ph-lb-nav-r"
          disabled={!nextId}
          onClick={() =>
            nextId && navigate(photoPath(nextId), { replace: true })
          }
          style={{ opacity: nextId ? 1 : 0.3 }}
          type="button"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      <div className="ph-lb-dock">
        <div className="ph-lb-tabs" role="tablist">
          <button
            aria-selected={tab === "info"}
            className={`ph-lb-tab ${tab === "info" ? "is-on" : ""}`}
            onClick={() => setTab("info")}
            role="tab"
            type="button"
          >
            {t("app.library.lightbox.tabInfo")}
          </button>
          <button
            aria-selected={tab === "exif"}
            className={`ph-lb-tab ${tab === "exif" ? "is-on" : ""}`}
            onClick={() => setTab("exif")}
            role="tab"
            type="button"
          >
            {t("app.library.lightbox.tabExif")}
          </button>
        </div>

        <div className="ph-lb-tab-body">
          {tab === "info" ? (
            <div className="ph-lb-grid">
              <Field label={t("app.library.lightbox.fieldDate")}>
                {formatDateTime(capturedAt)}
              </Field>
              <Field label={t("app.library.lightbox.fieldLocation")}>
                {hasCoordinates ? (
                  <>
                    <div>
                      {photo.latitude?.toFixed(4)},{" "}
                      {photo.longitude?.toFixed(4)}
                    </div>
                    <button
                      className="ph-lb-inline-link"
                      onClick={() => navigate("/app/library?view=map")}
                      type="button"
                    >
                      {t("app.library.lightbox.openInMap")} →
                    </button>
                  </>
                ) : (
                  <span className="muted">
                    {t("app.library.lightbox.noLocation")}
                  </span>
                )}
              </Field>
              <Field label={t("app.library.lightbox.fieldDimensions")}>
                {photo.width != null && photo.height != null
                  ? `${photo.width} × ${photo.height}`
                  : "—"}
              </Field>
              <Field label={t("app.library.lightbox.fieldSize")}>
                {formatBytes(photo.sizeBytes)}
              </Field>
              <Field label={t("app.library.lightbox.fieldType")}>
                {t(MEDIA_TYPE_LABEL[kind])}
              </Field>
              <Field label={t("app.library.lightbox.fieldFile")}>
                {photo.mimeType}
              </Field>
            </div>
          ) : exifEntries ? (
            <div className="ph-lb-grid">
              {exifEntries.map(([key, value]) => (
                <Field key={key} label={key}>
                  {value}
                </Field>
              ))}
            </div>
          ) : photo.exifData ? (
            <pre className="ph-lb-pre">{photo.exifData}</pre>
          ) : (
            <p className="ph-lb-value">
              <span className="muted">{t("app.library.lightbox.noExif")}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
