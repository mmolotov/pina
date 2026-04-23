import type { Route } from "./+types/app-library";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Form,
  Link,
  useActionData,
  useNavigate,
  useNavigation,
  useRevalidator,
  useSearchParams,
} from "react-router";
import {
  EmptyHint,
  EmptyState,
  InlineMessage,
  Panel,
} from "~/components/ui";
import { AlbumShareDialog } from "~/components/album-share-dialog";
import { ProportionalTimelineRail } from "~/components/proportional-timeline-rail";
import {
  ApiError,
  addFavorite,
  addPhotoToAlbum,
  createAlbumShareLink,
  createAlbum,
  downloadAlbumArchive,
  deleteAlbum,
  deletePhoto,
  getPhotoBlob,
  listGeoPhotos,
  listAllPhotos,
  listAlbumShareLinks,
  listAlbums,
  listFavorites,
  removeFavorite,
  revokeAlbumShareLink,
  updateAlbum,
  uploadPhoto,
} from "~/lib/api";
import { formatDateRange, formatRelativeCount } from "~/lib/format";
import {
  applyGeoViewportToSearchParams,
  buildGeoClusters,
  DEFAULT_GEO_VIEWPORT,
  panGeoViewport,
  parseGeoViewportFromSearchParams,
  zoomToClusterBounds,
  zoomGeoViewport,
} from "~/lib/geo";
import {
  getActiveLocale,
  translateMessage,
  useI18n,
  type Locale,
} from "~/lib/i18n";
import { resolveActionIntent, toActionErrorMessage } from "~/lib/route-actions";
import {
  buildDaySectionId,
  buildProportionalTimeline,
  buildTimelineGroups,
  formatDayLabel,
  type TimelineGroup,
} from "~/lib/timeline";
import type {
  AlbumDto,
  AlbumShareLinkDto,
  AlbumSortDirection,
  AlbumSortField,
  FavoriteDto,
  PhotoDto,
  PhotoGeoBounds,
} from "~/types/api";

type LibraryView = "everything" | "photos" | "timeline" | "albums" | "map";

interface GeoMapState {
  items: PhotoDto[];
  loading: boolean;
  errorMessage: string | null;
}

type GeoSelectionTarget = {
  id: string;
  kind: "cluster" | "photo";
};

interface LibraryLoaderData {
  photos: PhotoDto[];
  albums: AlbumDto[];
  photoFavorites: Record<string, FavoriteDto>;
  albumFavorites: Record<string, FavoriteDto>;
  albumSort: {
    sort: AlbumSortField;
    direction: AlbumSortDirection;
  };
  albumSortReset: boolean;
}

interface UploadProgressState {
  total: number;
  completed: number;
  currentFileName: string | null;
}

type LibraryActionResult =
  | {
      ok: true;
      intent: "delete-photo" | "create-album" | "update-album" | "delete-album";
      albumId?: string;
    }
  | {
      ok: false;
      intent: "delete-photo" | "create-album" | "update-album" | "delete-album";
      errorMessage: string;
    };

const DEFAULT_ALBUM_SORT: {
  sort: AlbumSortField;
  direction: AlbumSortDirection;
} = {
  sort: "createdAt",
  direction: "desc",
};

const ALBUM_SORT_OPTIONS: Array<{
  direction: AlbumSortDirection;
  labelKey: string;
  sort: AlbumSortField;
}> = [
  {
    sort: "name",
    direction: "asc",
    labelKey: "app.library.albumSortOption.nameAsc",
  },
  {
    sort: "name",
    direction: "desc",
    labelKey: "app.library.albumSortOption.nameDesc",
  },
  {
    sort: "itemCount",
    direction: "asc",
    labelKey: "app.library.albumSortOption.itemCountAsc",
  },
  {
    sort: "itemCount",
    direction: "desc",
    labelKey: "app.library.albumSortOption.itemCountDesc",
  },
  {
    sort: "createdAt",
    direction: "desc",
    labelKey: "app.library.albumSortOption.createdAtDesc",
  },
  {
    sort: "createdAt",
    direction: "asc",
    labelKey: "app.library.albumSortOption.createdAtAsc",
  },
  {
    sort: "updatedAt",
    direction: "desc",
    labelKey: "app.library.albumSortOption.updatedAtDesc",
  },
  {
    sort: "updatedAt",
    direction: "asc",
    labelKey: "app.library.albumSortOption.updatedAtAsc",
  },
  {
    sort: "newestPhoto",
    direction: "desc",
    labelKey: "app.library.albumSortOption.newestPhotoDesc",
  },
  {
    sort: "newestPhoto",
    direction: "asc",
    labelKey: "app.library.albumSortOption.newestPhotoAsc",
  },
];

function getSupportedUploadFiles(files: Iterable<File>) {
  return Array.from(files).filter(
    (file) => file.type === "image/jpeg" || file.type === "image/png",
  );
}

function formatUploadSummary(
  uploadedCount: number,
  totalCount: number,
  locale: Locale,
) {
  if (uploadedCount === totalCount) {
    return uploadedCount === 1
      ? translateMessage(locale, "app.library.uploadSummarySingle")
      : translateMessage(locale, "app.library.uploadSummaryPlural", {
          count: new Intl.NumberFormat(locale).format(uploadedCount),
        });
  }

  return translateMessage(locale, "app.library.uploadSummaryPartial", {
    uploadedCount: new Intl.NumberFormat(locale).format(uploadedCount),
    totalCount: new Intl.NumberFormat(locale).format(totalCount),
  });
}

function resolveLibraryView(value: string | null): LibraryView {
  return value === "timeline" || value === "albums" || value === "map"
    ? value
    : "photos";
}

function formatCoordinate(value: number | null) {
  return value == null ? "—" : value.toFixed(4);
}

function buildAlbumDetailPath(albumId: string) {
  return `/app/library/albums/${albumId}`;
}

function buildAlbumSortOptionValue(
  sort: AlbumSortField,
  direction: AlbumSortDirection,
) {
  return `${sort}:${direction}`;
}

function parseAlbumSortValue(value: string | null) {
  const [sort, direction] = value?.split(":") ?? [];
  return resolveAlbumSort(sort ?? null, direction ?? null);
}

function resolveAlbumSort(
  rawSort: string | null,
  rawDirection: string | null,
): {
  resetRequired: boolean;
  sort: AlbumSortField;
  direction: AlbumSortDirection;
} {
  const sort = rawSort as AlbumSortField | null;
  const direction = rawDirection as AlbumSortDirection | null;
  const valid = ALBUM_SORT_OPTIONS.some(
    (option) => option.sort === sort && option.direction === direction,
  );

  if (valid) {
    return {
      sort: sort!,
      direction: direction!,
      resetRequired: false,
    };
  }

  if (rawSort == null && rawDirection == null) {
    return {
      ...DEFAULT_ALBUM_SORT,
      resetRequired: false,
    };
  }

  return {
    ...DEFAULT_ALBUM_SORT,
    resetRequired: true,
  };
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

function AlbumTile(props: {
  album: AlbumDto;
  locale: Locale;
  photoForms: {
    one: string;
    few: string;
    many: string;
    other: string;
  };
  isFavorite: boolean;
  isFavoriteBusy: boolean;
  isShareBusy: boolean;
  isDownloadBusy: boolean;
  isDeleteBusy: boolean;
  onFavoriteToggle: () => void;
  onEdit: () => void;
  onShare: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (!props.album.coverPhotoId) {
      setCoverUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    getPhotoBlob(props.album.coverPhotoId, "THUMB_SM")
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
  }, [props.album.coverPhotoId]);

  const hasPhotos = props.album.photoCount > 0;
  const dateRangeLabel = hasPhotos
    ? formatDateRange(
        props.album.mediaRangeStart,
        props.album.mediaRangeEnd,
        props.locale,
      )
    : t("app.library.albumDateRangeEmpty");

  return (
    <article className="surface-card group relative overflow-visible rounded-[1.5rem]">
      <div className="absolute top-3 right-3 z-10">
        <button
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
          aria-label={t("app.library.albumMenuButtonAria", {
            albumName: props.album.name,
          })}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/55 text-lg font-medium text-white shadow-lg backdrop-blur transition hover:bg-black/70"
          onClick={() => {
            setIsMenuOpen((current) => !current);
          }}
          type="button"
        >
          <span aria-hidden>⋯</span>
        </button>

        {isMenuOpen ? (
          <div
            aria-label={t("app.library.albumMenuAria", {
              albumName: props.album.name,
            })}
            className="absolute top-12 right-0 flex w-56 flex-col rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-panel-strong)] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
            role="menu"
          >
            <button
              className="rounded-xl px-3 py-2 text-left text-sm font-medium transition hover:bg-[var(--color-surface-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={props.isFavoriteBusy}
              onClick={() => {
                setIsMenuOpen(false);
                props.onFavoriteToggle();
              }}
              type="button"
            >
              {props.isFavoriteBusy
                ? t("common.updating")
                : props.isFavorite
                  ? t("common.unfavorite")
                  : t("common.favorite")}
            </button>
            <button
              className="rounded-xl px-3 py-2 text-left text-sm font-medium transition hover:bg-[var(--color-surface-strong)]"
              onClick={() => {
                setIsMenuOpen(false);
                props.onEdit();
              }}
              type="button"
            >
              {t("app.library.editAlbumMenu")}
            </button>
            <button
              className="rounded-xl px-3 py-2 text-left text-sm font-medium transition hover:bg-[var(--color-surface-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={props.isShareBusy}
              onClick={() => {
                setIsMenuOpen(false);
                props.onShare();
              }}
              type="button"
            >
              {props.isShareBusy
                ? t("common.updating")
                : t("app.library.shareAlbumMenu")}
            </button>
            <button
              className="rounded-xl px-3 py-2 text-left text-sm font-medium transition hover:bg-[var(--color-surface-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={props.isDownloadBusy}
              onClick={() => {
                setIsMenuOpen(false);
                props.onDownload();
              }}
              type="button"
            >
              {props.isDownloadBusy
                ? t("common.loading")
                : t("app.library.downloadAlbumMenu")}
            </button>
            <button
              className="rounded-xl px-3 py-2 text-left text-sm font-medium text-[var(--color-danger)] transition hover:bg-[var(--color-surface-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={props.isDeleteBusy}
              onClick={() => {
                setIsMenuOpen(false);
                props.onDelete();
              }}
              type="button"
            >
              {props.isDeleteBusy ? t("common.deleting") : t("common.delete")}
            </button>
          </div>
        ) : null}
      </div>

      <Link
        aria-label={t("app.library.openAlbumAria", { albumName: props.album.name })}
        className="block"
        to={buildAlbumDetailPath(props.album.id)}
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-t-[1.5rem] bg-[radial-gradient(circle_at_top_left,_rgba(43,143,61,0.22),_transparent_55%),linear-gradient(180deg,rgba(216,226,197,0.92),rgba(244,240,231,0.98))]">
          {coverUrl ? (
            <img
              alt={t("app.library.albumCoverAlt", { albumName: props.album.name })}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
              src={coverUrl}
            />
          ) : (
            <div className="flex h-full flex-col justify-between p-5 text-[var(--color-text)]">
              <span className="eyebrow">
                {t("app.library.albumPlaceholderEyebrow")}
              </span>
              <div className="space-y-2">
                <div className="h-2.5 w-18 rounded-full bg-black/10" />
                <div className="h-2.5 w-26 rounded-full bg-black/10" />
                <p className="max-w-[12rem] text-sm text-[var(--color-text-muted)]">
                  {t("app.library.albumPlaceholderDescription")}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 px-4 py-4">
          <div className="min-w-0">
            <h3
              className="truncate text-base font-semibold tracking-tight"
              title={props.album.name}
            >
              {props.album.name}
            </h3>
            <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm leading-5 text-[var(--color-text-muted)]">
              {props.album.description || t("app.library.albumDescriptionFallback")}
            </p>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="eyebrow">{t("app.library.albumDateRangeLabel")}</dt>
              <dd className="mt-1 font-medium">{dateRangeLabel}</dd>
            </div>
            <div>
              <dt className="eyebrow">{t("app.library.albumItemsLabel")}</dt>
              <dd className="mt-1 font-medium">
                {formatRelativeCount(props.album.photoCount, props.photoForms)}
              </dd>
            </div>
          </dl>
        </div>
      </Link>
    </article>
  );
}

function AlbumEditDialog(props: {
  albumId: string;
  draft: { name: string; description: string };
  onDraftChange: (field: "name" | "description", value: string) => void;
  onClose: () => void;
  pending: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-4 py-8">
      <div
        aria-modal="true"
        className="w-full max-w-xl rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-panel-strong)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.28)]"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{t("app.library.editAlbumEyebrow")}</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              {t("app.library.editAlbumTitle")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
              {t("app.library.editAlbumDescription")}
            </p>
          </div>
          <button
            className="button-secondary"
            onClick={props.onClose}
            type="button"
          >
            {t("app.library.cancel")}
          </button>
        </div>

        <Form className="mt-6 space-y-4" method="post">
          <input name="intent" type="hidden" value="update-album" />
          <input name="albumId" type="hidden" value={props.albumId} />

          <label className="block">
            <span className="mb-2 block text-sm font-medium">{t("common.name")}</span>
            <input
              className="field"
              name="name"
              onChange={(event) => {
                props.onDraftChange("name", event.target.value);
              }}
              required
              value={props.draft.name}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">
              {t("common.description")}
            </span>
            <textarea
              className="field min-h-28 resize-y"
              name="description"
              onChange={(event) => {
                props.onDraftChange("description", event.target.value);
              }}
              value={props.draft.description}
            />
          </label>

          <div className="rounded-[1.25rem] border border-dashed border-[var(--color-border)] px-4 py-4">
            <p className="text-sm font-medium">
              {t("app.library.editAlbumCoverPickerTitle")}
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
              {t("app.library.editAlbumCoverPickerDescription")}
            </p>
            <Link
              className="mt-3 inline-flex text-sm font-medium text-[var(--color-link)] hover:text-[var(--color-link-hover)]"
              onClick={props.onClose}
              to={buildAlbumDetailPath(props.albumId)}
            >
              {t("app.library.openAlbumCoverPicker")}
            </Link>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              className="button-secondary"
              onClick={props.onClose}
              type="button"
            >
              {t("app.library.cancel")}
            </button>
            <button className="button-primary" disabled={props.pending} type="submit">
              {props.pending ? t("common.saving") : t("app.library.saveAlbum")}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}

function AlbumDeleteDialog(props: {
  album: AlbumDto;
  pending: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-4 py-8">
      <div
        aria-modal="true"
        className="w-full max-w-lg rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-panel-strong)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.28)]"
        role="dialog"
      >
        <p className="eyebrow">{t("app.library.deleteAlbumEyebrow")}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">
          {t("app.library.deleteAlbumTitle", { albumName: props.album.name })}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
          {t("app.library.deleteAlbumDescription")}
        </p>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button className="button-secondary" onClick={props.onClose} type="button">
            {t("app.library.cancel")}
          </button>
          <Form method="post">
            <input name="intent" type="hidden" value="delete-album" />
            <input name="albumId" type="hidden" value={props.album.id} />
            <button className="button-primary" disabled={props.pending} type="submit">
              {props.pending
                ? t("common.deleting")
                : t("app.library.confirmDeleteAlbum")}
            </button>
          </Form>
        </div>
      </div>
    </div>
  );
}

function CreateAlbumDialog(props: {
  draft: {
    name: string;
    description: string;
    existingFilter: string;
  };
  existingPhotos: PhotoDto[];
  selectedPhotoIds: string[];
  uploadProgress: UploadProgressState | null;
  batchProgress: UploadProgressState | null;
  uploadError: string | null;
  submitError: string | null;
  failures: string[];
  isBusy: boolean;
  isUploadTargetActive: boolean;
  onClose: () => void;
  onDraftChange: (
    field: "name" | "description" | "existingFilter",
    value: string,
  ) => void;
  onTogglePhoto: (photoId: string) => void;
  onSubmit: () => void;
  onUploadFiles: (files: File[]) => void;
  onUploadTargetActiveChange: (active: boolean) => void;
  partialAlbumId: string | null;
}) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const initialFocusRef = useRef<HTMLInputElement | null>(null);
  const isUploading = props.uploadProgress != null;
  const canClose = !props.isBusy && !isUploading;

  useEffect(() => {
    initialFocusRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!canClose) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        props.onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [canClose, props.onClose]);

  function trapFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !dialogRef.current) {
      return;
    }

    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );

    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-8">
      <div
        aria-modal="true"
        className="w-full max-w-4xl rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-panel-strong)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.28)]"
        onKeyDown={trapFocus}
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{t("app.library.createModalEyebrow")}</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              {t("app.library.createModalTitle")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
              {t("app.library.createModalDescription")}
            </p>
          </div>
          <button
            className="button-secondary"
            disabled={!canClose}
            onClick={props.onClose}
            type="button"
          >
            {t("app.library.cancel")}
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.42fr_0.58fr]">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">
                {t("common.name")}
              </span>
              <input
                className="field"
                maxLength={255}
                onChange={(event) => {
                  props.onDraftChange("name", event.target.value);
                }}
                ref={initialFocusRef}
                value={props.draft.name}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium">
                {t("common.description")}
              </span>
              <textarea
                className="field min-h-28 resize-y"
                maxLength={2000}
                onChange={(event) => {
                  props.onDraftChange("description", event.target.value);
                }}
                value={props.draft.description}
              />
            </label>

            <div className="rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <p className="eyebrow">{t("app.library.createModalUploadEyebrow")}</p>
              <p className="mt-1 text-sm font-medium">
                {t("app.library.createModalUploadTitle")}
              </p>
              <div
                className={`surface-dashed mt-3 rounded-lg px-4 py-4 text-center transition ${
                  props.isUploadTargetActive ? "dropzone-active" : ""
                }`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  props.onUploadTargetActiveChange(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  if (
                    event.currentTarget.contains(event.relatedTarget as Node | null)
                  ) {
                    return;
                  }
                  props.onUploadTargetActiveChange(false);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  props.onUploadTargetActiveChange(true);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (props.isBusy) {
                    return;
                  }
                  props.onUploadTargetActiveChange(false);
                  props.onUploadFiles(Array.from(event.dataTransfer.files));
                }}
              >
                {props.uploadProgress ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[var(--color-text)]">
                      {t("app.library.createModalUploadProgress", {
                        current: String(props.uploadProgress.completed),
                        total: String(props.uploadProgress.total),
                        fileName: props.uploadProgress.currentFileName ?? "",
                      })}
                    </p>
                    <div className="upload-progress-track">
                      <div
                        className="upload-progress-bar"
                        style={{
                          width: `${Math.round((props.uploadProgress.completed / props.uploadProgress.total) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {t("app.library.createModalUploadDescription")}
                    </p>
                    <label className="button-secondary inline-flex cursor-pointer">
                      <input
                        accept="image/jpeg,image/png"
                        aria-label={t("app.library.createModalUploadButton")}
                        className="hidden"
                        disabled={props.isBusy}
                        multiple
                        onChange={(event) => {
                          const files = event.target.files
                            ? Array.from(event.target.files)
                            : [];
                          if (files.length > 0) {
                            props.onUploadFiles(files);
                            event.target.value = "";
                          }
                        }}
                        type="file"
                      />
                      {t("app.library.createModalUploadButton")}
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="eyebrow">{t("app.library.createModalPickerEyebrow")}</p>
                  <p className="mt-1 text-sm font-medium">
                    {t("app.library.createModalPickerTitle")}
                  </p>
                </div>
                <input
                  aria-label={t("app.library.createModalPickerFilterLabel")}
                  className="field w-full py-1.5 text-sm sm:w-64"
                  onChange={(event) => {
                    props.onDraftChange("existingFilter", event.target.value);
                  }}
                  placeholder={t("app.library.createModalPickerFilterPlaceholder")}
                  type="search"
                  value={props.draft.existingFilter}
                />
              </div>

              <div className="mt-4 max-h-[26rem] overflow-y-auto">
                {props.existingPhotos.length === 0 ? (
                  <EmptyHint>{t("app.library.createModalNoPhotos")}</EmptyHint>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {props.existingPhotos.map((photo) => {
                      const selected = props.selectedPhotoIds.includes(photo.id);
                      return (
                        <button
                          aria-pressed={selected}
                          className={`rounded-[1.25rem] border px-4 py-3 text-left transition ${
                            selected
                              ? "border-[var(--color-accent-strong)] bg-[var(--color-surface-strong)]"
                              : "border-[var(--color-border)] bg-[var(--color-panel)] hover:border-[var(--color-accent)]"
                          }`}
                          disabled={props.isBusy || isUploading}
                          key={photo.id}
                          onClick={() => {
                            props.onTogglePhoto(photo.id);
                          }}
                          type="button"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {photo.originalFilename}
                              </p>
                              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                                {photo.mimeType}
                              </p>
                            </div>
                            <span className="shrink-0 text-xs font-medium text-[var(--color-text-muted)]">
                              {selected
                                ? t("app.library.createModalSelected")
                                : t("app.library.createModalSelect")}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-dashed border-[var(--color-border)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">
                  {t("app.library.createModalSelectedCount", {
                    count: String(props.selectedPhotoIds.length),
                  })}
                </span>
                {props.partialAlbumId ? (
                  <Link
                    className="text-sm font-medium text-[var(--color-link)] hover:text-[var(--color-link-hover)]"
                    onClick={props.onClose}
                    to={buildAlbumDetailPath(props.partialAlbumId)}
                  >
                    {t("app.library.createModalOpenPartialAlbum")}
                  </Link>
                ) : null}
              </div>

              {props.batchProgress ? (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {t("app.library.createModalBatchProgress", {
                      current: String(props.batchProgress.completed),
                      total: String(props.batchProgress.total),
                      fileName: props.batchProgress.currentFileName ?? "",
                    })}
                  </p>
                  <div className="upload-progress-track">
                    <div
                      className="upload-progress-bar"
                      style={{
                        width: `${Math.round((props.batchProgress.completed / props.batchProgress.total) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ) : null}

              {props.uploadError ? (
                <InlineMessage className="mt-3" tone="danger">
                  {props.uploadError}
                </InlineMessage>
              ) : null}

              {props.submitError ? (
                <InlineMessage className="mt-3" tone="danger">
                  {props.submitError}
                </InlineMessage>
              ) : null}

              {props.failures.length > 0 ? (
                <div className="mt-3 rounded-[1rem] border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3">
                  <p className="text-sm font-medium">
                    {t("app.library.createModalFailuresTitle")}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-[var(--color-text-muted)]">
                    {props.failures.map((failure) => (
                      <li key={failure}>• {failure}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            className="button-secondary"
            disabled={!canClose}
            onClick={props.onClose}
            type="button"
          >
            {t("app.library.cancel")}
          </button>
          <button
            className="button-primary"
            disabled={props.isBusy || isUploading}
            onClick={props.onSubmit}
            type="button"
          >
            {props.isBusy
              ? t("app.library.createModalCreating")
              : isUploading
                ? t("app.library.createModalUploading")
                : t("app.library.createModalSubmit")}
          </button>
        </div>
      </div>
    </div>
  );
}

function LibraryPhotoTile(props: {
  photo: PhotoDto;
  isFavorite: boolean;
  isFavoriteBusy: boolean;
  isDeleteBusy: boolean;
  onFavoriteToggle: () => void;
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

  const capturedAt = props.photo.takenAt ?? props.photo.createdAt;

  return (
    <div className="group overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <Link
        aria-label={t("app.library.photoTileAria", {
          fileName: props.photo.originalFilename,
        })}
        className="block"
        to={`/app/library/photos/${props.photo.id}`}
      >
        <div className="preview-frame relative aspect-[4/3] overflow-hidden border-0">
          {previewUrl ? (
            <img
              alt={t("app.library.photoPreviewAlt", {
                fileName: props.photo.originalFilename,
              })}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
              src={previewUrl}
            />
          ) : (
            <div className="preview-placeholder flex h-full items-center justify-center">
              <span className="text-xs text-[var(--color-text-muted)]">
                {props.photo.originalFilename}
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="space-y-1.5 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <Link
            className="min-w-0 truncate text-sm font-medium"
            to={`/app/library/photos/${props.photo.id}`}
          >
            {props.photo.originalFilename}
          </Link>
          <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
            {capturedAt.slice(11, 16)}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            aria-label={
              props.isFavorite
                ? t("app.library.removePhotoFavoriteAria", {
                    fileName: props.photo.originalFilename,
                  })
                : t("app.library.addPhotoFavoriteAria", {
                    fileName: props.photo.originalFilename,
                  })
            }
            className="link-accent font-medium"
            disabled={props.isFavoriteBusy}
            onClick={props.onFavoriteToggle}
            type="button"
          >
            {props.isFavoriteBusy
              ? t("common.updating")
              : props.isFavorite
                ? t("common.unfavorite")
                : t("common.favorite")}
          </button>
          <button
            className="text-link-danger font-medium"
            disabled={props.isDeleteBusy}
            form={`delete-photo-${props.photo.id}`}
            type="submit"
          >
            {props.isDeleteBusy ? t("common.deleting") : t("common.delete")}
          </button>
          <Form id={`delete-photo-${props.photo.id}`} method="post">
            <input name="intent" type="hidden" value="delete-photo" />
            <input name="photoId" type="hidden" value={props.photo.id} />
          </Form>
        </div>
      </div>
    </div>
  );
}

async function loadLibraryData(albumSort = DEFAULT_ALBUM_SORT): Promise<{
  photos: PhotoDto[];
  albums: AlbumDto[];
  photoFavorites: Record<string, FavoriteDto>;
  albumFavorites: Record<string, FavoriteDto>;
}> {
  const [photos, albums, photoFavoriteList, albumFavoriteList] = await Promise.all(
    [
      listAllPhotos(),
      listAlbums(albumSort),
      listFavorites("PHOTO"),
      listFavorites("ALBUM"),
    ],
  );

  return {
    photos,
    albums,
    photoFavorites: Object.fromEntries(
      photoFavoriteList.map((favorite) => [favorite.targetId, favorite]),
    ),
    albumFavorites: Object.fromEntries(
      albumFavoriteList.map((favorite) => [favorite.targetId, favorite]),
    ),
  };
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const resolvedSort = resolveAlbumSort(
    url.searchParams.get("sort"),
    url.searchParams.get("dir"),
  );

  try {
    const data = await loadLibraryData({
      sort: resolvedSort.sort,
      direction: resolvedSort.direction,
    });

    return {
      ...data,
      albumSort: {
        sort: resolvedSort.sort,
        direction: resolvedSort.direction,
      },
      albumSortReset: resolvedSort.resetRequired,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) {
      const data = await loadLibraryData(DEFAULT_ALBUM_SORT);
      return {
        ...data,
        albumSort: DEFAULT_ALBUM_SORT,
        albumSortReset: true,
      };
    }

    throw error;
  }
}

export async function clientAction({
  request,
}: Route.ClientActionArgs): Promise<LibraryActionResult> {
  const formData = await request.formData();
  const intent = resolveActionIntent(
    String(formData.get("intent") ?? ""),
    ["delete-photo", "create-album", "update-album", "delete-album"] as const,
    "create-album",
  );

  try {
    switch (intent) {
      case "delete-photo":
        await deletePhoto(String(formData.get("photoId") ?? ""));
        return { ok: true, intent };
      case "create-album":
        await createAlbum({
          name: String(formData.get("name") ?? "").trim(),
          description: String(formData.get("description") ?? "").trim(),
        });
        return { ok: true, intent };
      case "update-album": {
        const albumId = String(formData.get("albumId") ?? "");
        await updateAlbum(albumId, {
          name: String(formData.get("name") ?? "").trim(),
          description: String(formData.get("description") ?? "").trim(),
        });
        return { ok: true, intent, albumId };
      }
      case "delete-album": {
        const albumId = String(formData.get("albumId") ?? "");
        await deleteAlbum(albumId);
        return { ok: true, intent, albumId };
      }
      default:
        return {
          ok: false,
          intent: "create-album",
          errorMessage: translateMessage(
            getActiveLocale(),
            "app.library.actionUnknown",
          ),
        };
    }
  } catch (error) {
    return {
      ok: false,
      intent,
      errorMessage: toActionErrorMessage(
        error,
        translateMessage(getActiveLocale(), "app.library.actionFailed"),
      ),
    };
  }
}

export default function AppLibraryRoute({ loaderData }: Route.ComponentProps) {
  const { locale, t } = useI18n();
  const actionData = useActionData<typeof clientAction>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();
  const createAlbumTriggerRef = useRef<HTMLButtonElement | null>(null);
  const photosRef = useRef(loaderData.photos);
  const createSelectedPhotoIdsRef = useRef<string[]>([]);
  const [photos, setPhotos] = useState<PhotoDto[]>(loaderData.photos);
  const [albums, setAlbums] = useState<AlbumDto[]>(loaderData.albums);
  const [photoFavorites, setPhotoFavorites] = useState<
    Record<string, FavoriteDto>
  >(loaderData.photoFavorites);
  const [albumFavorites, setAlbumFavorites] = useState<
    Record<string, FavoriteDto>
  >(loaderData.albumFavorites);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isUploadTargetActive, setIsUploadTargetActive] = useState(false);
  const [uploadProgress, setUploadProgress] =
    useState<UploadProgressState | null>(null);
  const [favoriteBusyKey, setFavoriteBusyKey] = useState<string | null>(null);
  const [albumActionError, setAlbumActionError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<
    string | null
  >(null);
  const [libraryFilter, setLibraryFilter] = useState(
    searchParams.get("filter") ?? "",
  );
  const [libraryView, setLibraryView] = useState<LibraryView>(
    resolveLibraryView(searchParams.get("view")),
  );
  const [isCreateAlbumOpen, setIsCreateAlbumOpen] = useState(false);
  const [createAlbumDraft, setCreateAlbumDraft] = useState({
    name: "",
    description: "",
    existingFilter: "",
  });
  const [createSelectedPhotoIds, setCreateSelectedPhotoIds] = useState<string[]>(
    [],
  );
  const [createUploadProgress, setCreateUploadProgress] =
    useState<UploadProgressState | null>(null);
  const [createBatchProgress, setCreateBatchProgress] =
    useState<UploadProgressState | null>(null);
  const [isCreateUploadTargetActive, setIsCreateUploadTargetActive] =
    useState(false);
  const [createAlbumError, setCreateAlbumError] = useState<string | null>(null);
  const [createAlbumUploadError, setCreateAlbumUploadError] = useState<
    string | null
  >(null);
  const [createAlbumFailures, setCreateAlbumFailures] = useState<string[]>([]);
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
  const [partialCreatedAlbumId, setPartialCreatedAlbumId] = useState<
    string | null
  >(null);
  const [albumActionSuccess, setAlbumActionSuccess] = useState<string | null>(null);
  const [albumSortMessage, setAlbumSortMessage] = useState<string | null>(
    loaderData.albumSortReset ? t("app.library.albumSortReset") : null,
  );
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
  const [editAlbumDraft, setEditAlbumDraft] = useState({
    name: "",
    description: "",
  });
  const [shareBusyAlbumId, setShareBusyAlbumId] = useState<string | null>(null);
  const [downloadBusyAlbumId, setDownloadBusyAlbumId] = useState<string | null>(
    null,
  );
  const [shareDialogAlbum, setShareDialogAlbum] = useState<AlbumDto | null>(null);
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
  const [deleteDialogAlbumId, setDeleteDialogAlbumId] = useState<string | null>(
    null,
  );
  const [geoMapState, setGeoMapState] = useState<GeoMapState>({
    items: [],
    loading: false,
    errorMessage: null,
  });
  const [selectedGeoTarget, setSelectedGeoTarget] =
    useState<GeoSelectionTarget | null>(null);

  const pendingIntent = String(navigation.formData?.get("intent") ?? "");
  const pendingAlbumId = String(navigation.formData?.get("albumId") ?? "");
  const pendingPhotoId = String(navigation.formData?.get("photoId") ?? "");
  const albumSortSelection = useMemo(
    () =>
      resolveAlbumSort(searchParams.get("sort"), searchParams.get("dir")),
    [searchParams],
  );
  const geoViewport = useMemo(
    () => parseGeoViewportFromSearchParams(searchParams),
    [searchParams],
  );
  const deferredGeoViewport = useDeferredValue(geoViewport);
  const normalizedLibraryFilter = libraryFilter.trim().toLowerCase();
  const filteredPhotos = useMemo(
    () =>
      photos.filter((photo) => {
        if (normalizedLibraryFilter.length === 0) {
          return true;
        }
        return (
          photo.originalFilename
            .toLowerCase()
            .includes(normalizedLibraryFilter) ||
          photo.mimeType.toLowerCase().includes(normalizedLibraryFilter)
        );
      }),
    [normalizedLibraryFilter, photos],
  );
  const filteredAlbums = useMemo(
    () =>
      albums.filter((album) => {
        if (normalizedLibraryFilter.length === 0) {
          return true;
        }
        return (
          album.name.toLowerCase().includes(normalizedLibraryFilter) ||
          (album.description ?? "")
            .toLowerCase()
            .includes(normalizedLibraryFilter)
        );
      }),
    [albums, normalizedLibraryFilter],
  );
  const filteredGeoItems = useMemo(
    () =>
      geoMapState.items.filter((photo) => {
        if (normalizedLibraryFilter.length === 0) {
          return true;
        }
        return (
          photo.originalFilename
            .toLowerCase()
            .includes(normalizedLibraryFilter) ||
          photo.mimeType.toLowerCase().includes(normalizedLibraryFilter)
        );
      }),
    [geoMapState.items, normalizedLibraryFilter],
  );
  const normalizedCreatePhotoFilter = createAlbumDraft.existingFilter
    .trim()
    .toLowerCase();
  const filteredCreateLibraryPhotos = useMemo(
    () =>
      photos.filter((photo) => {
        if (normalizedCreatePhotoFilter.length === 0) {
          return true;
        }

        return photo.originalFilename
          .toLowerCase()
          .includes(normalizedCreatePhotoFilter);
      }),
    [normalizedCreatePhotoFilter, photos],
  );

  const timelineGroups = useMemo<TimelineGroup[]>(
    () => buildTimelineGroups(filteredPhotos),
    [filteredPhotos],
  );
  const timelineMarkers = useMemo(
    () => buildProportionalTimeline(timelineGroups, locale),
    [timelineGroups, locale],
  );
  const geoTaggedPhotoCount = useMemo(
    () =>
      photos.filter(
        (photo) => photo.latitude != null && photo.longitude != null,
      ).length,
    [photos],
  );
  const geoClusters = useMemo(
    () => buildGeoClusters(filteredGeoItems, geoViewport),
    [filteredGeoItems, geoViewport],
  );
  const selectedGeoCluster = useMemo(() => {
    if (selectedGeoTarget?.kind !== "cluster") {
      return null;
    }

    return (
      geoClusters.find((cluster) => cluster.id === selectedGeoTarget.id) ?? null
    );
  }, [geoClusters, selectedGeoTarget]);
  const selectedGeoPhoto = useMemo(() => {
    if (selectedGeoTarget?.kind === "photo") {
      return (
        filteredGeoItems.find((photo) => photo.id === selectedGeoTarget.id) ??
        null
      );
    }

    if (selectedGeoCluster?.photos.length === 1) {
      return selectedGeoCluster.photos[0] ?? null;
    }

    return null;
  }, [filteredGeoItems, selectedGeoCluster, selectedGeoTarget]);
  const selectedGeoClusterPhotos = selectedGeoCluster?.photos ?? [];
  const editingAlbum =
    editingAlbumId == null
      ? null
      : albums.find((album) => album.id === editingAlbumId) ?? null;
  const deleteDialogAlbum =
    deleteDialogAlbumId == null
      ? null
      : albums.find((album) => album.id === deleteDialogAlbumId) ?? null;
  const countFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const photoForms = {
    one: t("unit.photo.one"),
    few: t("unit.photo.few"),
    many: t("unit.photo.many"),
    other: t("unit.photo.other"),
  };
  const dayGroupForms = {
    one: t("unit.dayGroup.one"),
    few: t("unit.dayGroup.few"),
    many: t("unit.dayGroup.many"),
    other: t("unit.dayGroup.other"),
  };
  const geoPhotoForms = {
    one: t("unit.geoPhoto.one"),
    few: t("unit.geoPhoto.few"),
    many: t("unit.geoPhoto.many"),
    other: t("unit.geoPhoto.other"),
  };

  useEffect(() => {
    setLibraryView(resolveLibraryView(searchParams.get("view")));
    setLibraryFilter(searchParams.get("filter") ?? "");
  }, [searchParams]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    startTransition(() => {
      setPhotos(loaderData.photos);
      setAlbums(loaderData.albums);
      setPhotoFavorites(loaderData.photoFavorites);
      setAlbumFavorites(loaderData.albumFavorites);
    });
    photosRef.current = loaderData.photos;
  }, [loaderData]);

  useEffect(() => {
    if (!loaderData.albumSortReset) {
      return;
    }

    setAlbumSortMessage(t("app.library.albumSortReset"));
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("sort", DEFAULT_ALBUM_SORT.sort);
    nextParams.set("dir", DEFAULT_ALBUM_SORT.direction);
    setSearchParams(nextParams, { replace: true });
  }, [loaderData.albumSortReset, searchParams, setSearchParams, t]);

  useEffect(() => {
    if (!albumActionSuccess) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setAlbumActionSuccess(null);
    }, 2600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [albumActionSuccess]);

  useEffect(() => {
    if (libraryView !== "map") {
      return;
    }

    let cancelled = false;
    setGeoMapState((current) => ({
      items: current.items,
      loading: true,
      errorMessage: null,
    }));

    void listGeoPhotos({
      ...deferredGeoViewport,
      page: 0,
      size: 100,
      needsTotal: true,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setGeoMapState({
            items: response.items,
            loading: false,
            errorMessage: null,
          });
          setSelectedGeoTarget((current) => {
            if (
              current?.kind === "photo" &&
              response.items.some((photo) => photo.id === current.id)
            ) {
              return current;
            }
            return response.items[0]
              ? {
                  id: response.items[0].id,
                  kind: "photo",
                }
              : null;
          });
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setGeoMapState({
          items: [],
          loading: false,
          errorMessage:
            error instanceof Error
              ? error.message
              : t("app.library.mapLoadFailed"),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [deferredGeoViewport, libraryView, t]);

  useEffect(() => {
    if (libraryView !== "map") {
      return;
    }

    setSelectedGeoTarget((current) => {
      if (current == null) {
        return null;
      }

      if (current?.kind === "photo") {
        if (filteredGeoItems.some((photo) => photo.id === current.id)) {
          return current;
        }
      } else if (current?.kind === "cluster") {
        if (geoClusters.some((cluster) => cluster.id === current.id)) {
          return current;
        }
      }

      return null;
    });
  }, [filteredGeoItems, geoClusters, libraryView]);

  useEffect(() => {
    if (!actionData) {
      return;
    }

    if (actionData.ok) {
      setAlbumActionError(null);
      setAlbumActionSuccess(null);
      setUploadError(null);
      setUploadSuccessMessage(null);
      if (actionData.intent === "update-album") {
        setEditingAlbumId(null);
      }
      if (actionData.intent === "delete-album") {
        setDeleteDialogAlbumId(null);
      }
      revalidator.revalidate();
      return;
    }

    if (actionData.intent === "delete-photo") {
      setUploadError(actionData.errorMessage);
      return;
    }

    setAlbumActionError(actionData.errorMessage);
  }, [actionData, revalidator]);

  async function reloadLibrary() {
    try {
      setErrorMessage(null);
      const nextData = await loadLibraryData({
        sort: albumSortSelection.sort,
        direction: albumSortSelection.direction,
      });

      startTransition(() => {
        setPhotos(nextData.photos);
        setAlbums(nextData.albums);
        setPhotoFavorites(nextData.photoFavorites);
        setAlbumFavorites(nextData.albumFavorites);
      });
      photosRef.current = nextData.photos;
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : t("app.library.loadFailed"),
      );
    }
  }

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) {
      return;
    }

    await uploadSelectedFiles(files);
    event.target.value = "";
  }

  async function uploadSelectedFiles(files: File[]) {
    const supportedFiles = getSupportedUploadFiles(files);
    if (supportedFiles.length === 0) {
      setUploadError(t("app.library.uploadTypeError"));
      setUploadSuccessMessage(null);
      return;
    }

    setUploadingPhoto(true);
    setUploadError(null);
    setUploadSuccessMessage(null);
    setUploadProgress({
      total: supportedFiles.length,
      completed: 0,
      currentFileName: supportedFiles[0]?.name ?? null,
    });

    let uploadedCount = 0;
    const failedUploads: string[] = [];

    try {
      for (const [index, file] of supportedFiles.entries()) {
        setUploadProgress({
          total: supportedFiles.length,
          completed: uploadedCount,
          currentFileName: file.name,
        });

        try {
          await uploadPhoto(file);
          uploadedCount += 1;
        } catch (error) {
          failedUploads.push(
            error instanceof ApiError
              ? `${file.name}: ${error.message}`
              : t("app.library.uploadFileFailed", {
                  fileName: file.name,
                }),
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
        await reloadLibrary();
        setUploadSuccessMessage(
          formatUploadSummary(uploadedCount, supportedFiles.length, locale),
        );
      }

      if (failedUploads.length > 0) {
        setUploadError(failedUploads.join(" "));
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setUploadError(error.message);
      } else {
        setUploadError(t("app.library.uploadFailed"));
      }
    } finally {
      setUploadingPhoto(false);
      setUploadProgress(null);
    }
  }

  function resetCreateAlbumState() {
    createSelectedPhotoIdsRef.current = [];
    setCreateAlbumDraft({
      name: "",
      description: "",
      existingFilter: "",
    });
    setCreateSelectedPhotoIds([]);
    setCreateUploadProgress(null);
    setCreateBatchProgress(null);
    setIsCreateUploadTargetActive(false);
    setCreateAlbumError(null);
    setCreateAlbumUploadError(null);
    setCreateAlbumFailures([]);
    setPartialCreatedAlbumId(null);
    setIsCreatingAlbum(false);
  }

  function openCreateAlbumDialog() {
    resetCreateAlbumState();
    setIsCreateAlbumOpen(true);
  }

  function closeCreateAlbumDialog() {
    if (isCreatingAlbum || createUploadProgress != null) {
      return;
    }
    setIsCreateAlbumOpen(false);
    resetCreateAlbumState();
    window.setTimeout(() => {
      createAlbumTriggerRef.current?.focus();
    }, 0);
  }

  function updateCreateAlbumDraft(
    field: "name" | "description" | "existingFilter",
    value: string,
  ) {
    setCreateAlbumDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleCreateAlbumPhotoSelection(photoId: string) {
    setCreateSelectedPhotoIds((current) =>
      {
        const next = current.includes(photoId)
          ? current.filter((id) => id !== photoId)
          : [...current, photoId];
        createSelectedPhotoIdsRef.current = next;
        return next;
      },
    );
  }

  async function handleCreateAlbumUploads(files: File[]) {
    const supportedFiles = getSupportedUploadFiles(files);
    if (supportedFiles.length === 0) {
      setCreateAlbumUploadError(t("app.library.uploadTypeError"));
      return;
    }

    setCreateAlbumUploadError(null);
    setCreateAlbumFailures([]);
    setCreateUploadProgress({
      total: supportedFiles.length,
      completed: 0,
      currentFileName: supportedFiles[0]?.name ?? null,
    });

    const uploadFailures: string[] = [];
    const uploadedPhotos: PhotoDto[] = [];
    let uploadedCount = 0;

    try {
      for (const [index, file] of supportedFiles.entries()) {
        setCreateUploadProgress({
          total: supportedFiles.length,
          completed: uploadedCount,
          currentFileName: file.name,
        });

        try {
          const photo = await uploadPhoto(file);
          uploadedPhotos.push(photo);
          uploadedCount += 1;
        } catch (error) {
          uploadFailures.push(
            error instanceof ApiError
              ? `${file.name}: ${error.message}`
              : t("app.library.uploadFileFailed", {
                  fileName: file.name,
                }),
          );
        }

        setCreateUploadProgress({
          total: supportedFiles.length,
          completed: uploadedCount,
          currentFileName:
            index < supportedFiles.length - 1
              ? supportedFiles[index + 1]!.name
              : null,
        });
      }

      if (uploadedPhotos.length > 0) {
        const mergedSelectedPhotoIds = [
          ...new Set([
            ...createSelectedPhotoIdsRef.current,
            ...uploadedPhotos.map((photo) => photo.id),
          ]),
        ];
        const nextPhotos = [...uploadedPhotos, ...photosRef.current];
        createSelectedPhotoIdsRef.current = mergedSelectedPhotoIds;
        photosRef.current = nextPhotos;

        startTransition(() => {
          setPhotos(nextPhotos);
          setCreateSelectedPhotoIds(mergedSelectedPhotoIds);
        });
      }

      if (uploadFailures.length > 0) {
        setCreateAlbumUploadError(uploadFailures.join(" "));
      }
    } finally {
      setCreateUploadProgress(null);
    }
  }

  async function handleCreateAlbumSubmit() {
    if (createUploadProgress != null) {
      setCreateAlbumError(t("app.library.createModalWaitForUploads"));
      return;
    }

    const trimmedName = createAlbumDraft.name.trim();
    const trimmedDescription = createAlbumDraft.description.trim();

    if (trimmedName.length === 0) {
      setCreateAlbumError(t("app.library.createModalNameRequired"));
      return;
    }
    if (trimmedName.length > 255) {
      setCreateAlbumError(t("app.library.createModalNameTooLong"));
      return;
    }
    if (trimmedDescription.length > 2000) {
      setCreateAlbumError(t("app.library.createModalDescriptionTooLong"));
      return;
    }

    setIsCreatingAlbum(true);
    setCreateAlbumError(null);
    setCreateAlbumFailures([]);
    setPartialCreatedAlbumId(null);

    try {
      const album = await createAlbum({
        name: trimmedName,
        description: trimmedDescription,
      });
      const selectedPhotoIds = createSelectedPhotoIdsRef.current;
      const selectedPhotos = photosRef.current.filter((photo) =>
        selectedPhotoIds.includes(photo.id),
      );

      if (selectedPhotos.length > 0) {
        const failures: string[] = [];
        let completed = 0;

        setCreateBatchProgress({
          total: selectedPhotos.length,
          completed: 0,
          currentFileName: selectedPhotos[0]?.originalFilename ?? null,
        });

        for (const [index, photo] of selectedPhotos.entries()) {
          setCreateBatchProgress({
            total: selectedPhotos.length,
            completed,
            currentFileName: photo.originalFilename,
          });

          try {
            await addPhotoToAlbum(album.id, photo.id);
            completed += 1;
          } catch (error) {
            failures.push(
              error instanceof Error
                ? `${photo.originalFilename}: ${error.message}`
                : t("app.library.createModalAddPhotoFailed", {
                    fileName: photo.originalFilename,
                  }),
            );
          }

          setCreateBatchProgress({
            total: selectedPhotos.length,
            completed,
            currentFileName:
              index < selectedPhotos.length - 1
                ? selectedPhotos[index + 1]!.originalFilename
                : null,
          });
        }

        if (failures.length > 0) {
          await reloadLibrary();
          setCreateAlbumFailures(failures);
          setCreateAlbumError(t("app.library.createModalPartialFailure"));
          setPartialCreatedAlbumId(album.id);
          return;
        }
      }

      await reloadLibrary();
      setIsCreateAlbumOpen(false);
      resetCreateAlbumState();
      navigate(buildAlbumDetailPath(album.id));
    } catch (error) {
      if (error instanceof Error && error.message) {
        setCreateAlbumError(error.message);
      } else {
        setCreateAlbumError(t("app.library.createModalCreateFailed"));
      }
    } finally {
      setIsCreatingAlbum(false);
      setCreateBatchProgress(null);
    }
  }

  async function handlePhotoFavoriteToggle(photoId: string) {
    const favorite = photoFavorites[photoId];
    setFavoriteBusyKey(`photo:${photoId}`);

    try {
      if (favorite) {
        await removeFavorite(favorite.id);
      } else {
        await addFavorite("PHOTO", photoId);
      }
      await reloadLibrary();
    } catch (error) {
      if (error instanceof ApiError) {
        setAlbumActionError(error.message);
      } else {
        setAlbumActionError(t("app.library.photoFavoriteFailed"));
      }
    } finally {
      setFavoriteBusyKey(null);
    }
  }

  async function handleAlbumFavoriteToggle(albumId: string) {
    const favorite = albumFavorites[albumId];
    setFavoriteBusyKey(`album:${albumId}`);

    try {
      if (favorite) {
        await removeFavorite(favorite.id);
      } else {
        await addFavorite("ALBUM", albumId);
      }
      await reloadLibrary();
    } catch (error) {
      if (error instanceof ApiError) {
        setAlbumActionError(error.message);
      } else {
        setAlbumActionError(t("app.library.albumFavoriteFailed"));
      }
    } finally {
      setFavoriteBusyKey(null);
    }
  }

  async function openAlbumShareDialog(album: AlbumDto) {
    setShareBusyAlbumId(album.id);
    setShareDialogAlbum(album);
    setShareDialogLoading(true);
    setShareDialogLinks([]);
    setShareDialogToken(null);
    setShareDialogError(null);
    setShareDialogInfo(null);

    try {
      const links = await listAlbumShareLinks(album.id);
      setShareDialogLinks(links);
    } catch (error) {
      if (error instanceof Error && error.message) {
        setShareDialogError(error.message);
      } else {
        setShareDialogError(t("app.library.albumShareFailed"));
      }
    } finally {
      setShareDialogLoading(false);
      setShareBusyAlbumId(null);
    }
  }

  function closeAlbumShareDialog() {
    setShareDialogAlbum(null);
    setShareDialogLinks([]);
    setShareDialogLoading(false);
    setShareDialogCreating(false);
    setShareDialogRevokeBusyId(null);
    setShareDialogToken(null);
    setShareDialogError(null);
    setShareDialogInfo(null);
  }

  async function copyTextToClipboard(
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
      if (error instanceof Error && error.message) {
        setShareDialogError(error.message);
      } else {
        setShareDialogError(failureMessage);
      }
    }
  }

  async function handleCreateShareLink() {
    if (!shareDialogAlbum) {
      return;
    }

    setShareDialogCreating(true);
    setShareDialogError(null);
    setShareDialogInfo(null);

    try {
      const created = await createAlbumShareLink(shareDialogAlbum.id);
      setShareDialogToken(created.token);
      setShareDialogLinks((current) => [created.link, ...current]);
      setShareDialogInfo(
        t("app.albumShare.createdSuccess", {
          albumName: shareDialogAlbum.name,
        }),
      );
    } catch (error) {
      if (error instanceof Error && error.message) {
        setShareDialogError(error.message);
      } else {
        setShareDialogError(t("app.library.albumShareFailed"));
      }
    } finally {
      setShareDialogCreating(false);
    }
  }

  async function handleRevokeShareLink(linkId: string) {
    if (!shareDialogAlbum) {
      return;
    }

    setShareDialogRevokeBusyId(linkId);
    setShareDialogError(null);
    setShareDialogInfo(null);

    try {
      await revokeAlbumShareLink(shareDialogAlbum.id, linkId);
      const links = await listAlbumShareLinks(shareDialogAlbum.id);
      setShareDialogLinks(links);
      setShareDialogInfo(t("app.albumShare.revokedSuccess"));
    } catch (error) {
      if (error instanceof Error && error.message) {
        setShareDialogError(error.message);
      } else {
        setShareDialogError(t("app.albumShare.revokeFailed"));
      }
    } finally {
      setShareDialogRevokeBusyId(null);
    }
  }

  async function handleAlbumDownload(album: AlbumDto) {
    setDownloadBusyAlbumId(album.id);
    setAlbumActionError(null);

    try {
      const { blob, filename } = await downloadAlbumArchive(album.id, "ORIGINAL");
      triggerBlobDownload(blob, filename);
      setAlbumActionSuccess(
        t("app.library.albumDownloadStarted", {
          albumName: album.name,
        }),
      );
    } catch (error) {
      if (error instanceof Error && error.message) {
        setAlbumActionError(error.message);
      } else {
        setAlbumActionError(t("app.library.albumDownloadFailed"));
      }
      setAlbumActionSuccess(null);
    } finally {
      setDownloadBusyAlbumId(null);
    }
  }

  function openAlbumEditor(album: AlbumDto) {
    setEditingAlbumId(album.id);
    setEditAlbumDraft({
      name: album.name,
      description: album.description ?? "",
    });
    setAlbumActionError(null);
    setAlbumActionSuccess(null);
  }

  function updateEditAlbumDraft(
    field: "name" | "description",
    value: string,
  ) {
    setEditAlbumDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function setMapViewport(nextViewport: PhotoGeoBounds) {
    const nextParams = applyGeoViewportToSearchParams(
      searchParams,
      nextViewport,
    );
    nextParams.set("view", "map");
    setSearchParams(nextParams, { replace: true });
  }

  function activateLibraryView(nextView: LibraryView) {
    setLibraryView(nextView);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("view", nextView);

    if (nextView === "map") {
      const seededParams = applyGeoViewportToSearchParams(
        nextParams,
        geoViewport,
      );
      setSearchParams(seededParams, { replace: true });
      return;
    }

    setSearchParams(nextParams, { replace: true });
  }

  function updateLibraryFilter(value: string) {
    setLibraryFilter(value);
    const nextParams = new URLSearchParams(searchParams);
    if (value.trim().length === 0) {
      nextParams.delete("filter");
    } else {
      nextParams.set("filter", value);
    }
    setSearchParams(nextParams, { replace: true });
  }

  function updateAlbumSort(value: string) {
    const resolved = parseAlbumSortValue(value);
    setAlbumSortMessage(null);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("view", "albums");
    nextParams.set("sort", resolved.sort);
    nextParams.set("dir", resolved.direction);
    setSearchParams(nextParams, { replace: true });
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-4 -mt-4 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 sm:-mx-6 sm:-mt-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {[
              { id: "photos", label: t("app.library.view.photos") },
              { id: "timeline", label: t("app.library.view.timeline") },
              { id: "map", label: t("app.library.view.map") },
              { id: "albums", label: t("app.library.view.albums") },
            ].map((option) => (
              <button
                aria-pressed={libraryView === option.id}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  libraryView === option.id
                    ? "bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]"
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
                }`}
                key={option.id}
                onClick={() => activateLibraryView(option.id as LibraryView)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <input
              aria-label={t("app.library.filterLabel")}
              className="field w-48 py-1.5 text-sm lg:w-64"
              onChange={(event) => updateLibraryFilter(event.target.value)}
              placeholder={t("app.library.filterPlaceholder")}
              type="search"
              value={libraryFilter}
            />
            {libraryView === "albums" ? (
              <button
                className="button-primary py-1.5 text-sm"
                onClick={openCreateAlbumDialog}
                ref={createAlbumTriggerRef}
                type="button"
              >
                {t("app.library.createModalOpenButton")}
              </button>
            ) : libraryView !== "map" ? (
              <label className="button-primary cursor-pointer py-1.5 text-sm">
                <input
                  accept="image/jpeg,image/png"
                  aria-label={t("app.library.uploadPhotos")}
                  className="hidden"
                  disabled={uploadingPhoto}
                  multiple
                  onChange={handlePhotoUpload}
                  type="file"
                />
                {uploadingPhoto
                  ? t("app.library.uploadingPhotos")
                  : t("app.library.uploadPhotos")}
              </label>
            ) : null}
          </div>
        </div>
      </div>

      {errorMessage ? (
        <Panel className="p-4">
          <p className="alert-danger">{errorMessage}</p>
        </Panel>
      ) : null}

      <section
        className={`grid gap-6 ${
          libraryView === "photos" || libraryView === "timeline"
            ? "xl:grid-cols-[minmax(0,1fr)_15rem]"
            : ""
        }`}
      >
        {(libraryView === "photos" ||
          libraryView === "timeline" ||
          libraryView === "map") && (
          <div>
            {libraryView === "map" ? (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-sm text-[var(--color-text-muted)]">
                  {countFormatter.format(filteredGeoItems.length)}{" "}
                  {formatRelativeCount(filteredGeoItems.length, geoPhotoForms)}
                </span>
                <div className="ml-auto flex flex-wrap gap-1">
                  <button
                    className="button-secondary py-1 text-sm"
                    disabled={selectedGeoTarget == null}
                    onClick={() => setSelectedGeoTarget(null)}
                    type="button"
                  >
                    {t("app.library.clearSelection")}
                  </button>
                  <button
                    className="button-secondary py-1 text-sm"
                    onClick={() => setMapViewport(DEFAULT_GEO_VIEWPORT)}
                    type="button"
                  >
                    {t("app.library.worldView")}
                  </button>
                  <button
                    className="button-secondary py-1 text-sm"
                    onClick={() =>
                      setMapViewport(zoomGeoViewport(geoViewport, "in"))
                    }
                    type="button"
                  >
                    {t("app.library.zoomIn")}
                  </button>
                  <button
                    className="button-secondary py-1 text-sm"
                    onClick={() =>
                      setMapViewport(zoomGeoViewport(geoViewport, "out"))
                    }
                    type="button"
                  >
                    {t("app.library.zoomOut")}
                  </button>
                </div>
              </div>
            ) : null}

            {libraryView === "map" ? (
              <>
                <div className="grid gap-3 lg:grid-cols-[0.72fr_0.28fr]">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        className="button-secondary py-1 text-sm"
                        onClick={() =>
                          setMapViewport(panGeoViewport(geoViewport, "west"))
                        }
                        type="button"
                      >
                        {t("app.library.panWest")}
                      </button>
                      <button
                        className="button-secondary py-1 text-sm"
                        onClick={() =>
                          setMapViewport(panGeoViewport(geoViewport, "east"))
                        }
                        type="button"
                      >
                        {t("app.library.panEast")}
                      </button>
                      <button
                        className="button-secondary py-1 text-sm"
                        onClick={() =>
                          setMapViewport(panGeoViewport(geoViewport, "north"))
                        }
                        type="button"
                      >
                        {t("app.library.panNorth")}
                      </button>
                      <button
                        className="button-secondary py-1 text-sm"
                        onClick={() =>
                          setMapViewport(panGeoViewport(geoViewport, "south"))
                        }
                        type="button"
                      >
                        {t("app.library.panSouth")}
                      </button>
                    </div>
                    <div className="map-shell rounded-lg p-2">
                      <div className="map-canvas relative min-h-[28rem] overflow-hidden rounded-[1.25rem]">
                        {geoMapState.loading ? (
                          <div className="map-overlay absolute inset-0 flex items-center justify-center text-sm font-semibold">
                            {t("app.library.loadingMarkers")}
                          </div>
                        ) : null}
                        {geoClusters.map((cluster) => {
                          const isCluster = cluster.photos.length > 1;
                          const leadPhoto = cluster.photos[0];
                          const isSelected = isCluster
                            ? selectedGeoTarget?.kind === "cluster" &&
                              selectedGeoTarget.id === cluster.id
                            : selectedGeoTarget?.kind === "photo" &&
                              selectedGeoTarget.id === leadPhoto?.id;

                          if (!leadPhoto) {
                            return null;
                          }

                          return (
                            <button
                              aria-label={
                                isCluster
                                  ? t("app.library.openClusterAria", {
                                      count: countFormatter.format(
                                        cluster.photos.length,
                                      ),
                                    })
                                  : t("app.library.openMarkerAria", {
                                      fileName: leadPhoto.originalFilename,
                                    })
                              }
                              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm transition ${
                                isCluster
                                  ? "min-h-8 min-w-8 px-2 text-xs font-semibold"
                                  : "h-4 w-4"
                              } ${
                                isSelected
                                  ? "bg-[var(--color-primary-strong)] text-white ring-4 ring-[var(--map-selected-ring)]"
                                  : "bg-[var(--color-accent-strong)] text-[var(--color-text)] hover:bg-[var(--color-primary-strong)] hover:text-white"
                              }`}
                              key={cluster.id}
                              onClick={() => {
                                if (isCluster) {
                                  setSelectedGeoTarget({
                                    id: cluster.id,
                                    kind: "cluster",
                                  });
                                  return;
                                }

                                setSelectedGeoTarget({
                                  id: leadPhoto.id,
                                  kind: "photo",
                                });
                              }}
                              style={{
                                left: `${cluster.position.left}%`,
                                top: `${cluster.position.top}%`,
                              }}
                              type="button"
                            >
                              {isCluster ? cluster.photos.length : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <dl className="space-y-1 text-xs text-[var(--color-text-muted)]">
                      <div className="flex justify-between gap-4">
                        <dt>{t("app.library.viewportMarkers")}</dt>
                        <dd>{geoClusters.length}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>{t("app.library.viewportPhotosInView")}</dt>
                        <dd>{filteredGeoItems.length}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>{t("app.library.viewportSelection")}</dt>
                        <dd>
                          {selectedGeoCluster &&
                          selectedGeoCluster.photos.length > 1
                            ? t("app.library.selectionCluster", {
                                count: countFormatter.format(
                                  selectedGeoCluster.photos.length,
                                ),
                              })
                            : selectedGeoPhoto
                              ? t("app.library.selectionSinglePhoto")
                              : t("app.library.selectionNone")}
                        </dd>
                      </div>
                    </dl>

                    {geoMapState.errorMessage ? (
                      <InlineMessage className="mt-4" tone="danger">
                        {geoMapState.errorMessage}
                      </InlineMessage>
                    ) : null}

                    {selectedGeoCluster &&
                    selectedGeoCluster.photos.length > 1 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">
                          {t("app.library.clusterTitle", {
                            count: countFormatter.format(
                              selectedGeoCluster.photos.length,
                            ),
                          })}
                        </p>
                        <button
                          className="button-secondary w-full py-1 text-sm"
                          onClick={() =>
                            setMapViewport(
                              zoomToClusterBounds(selectedGeoCluster.bounds),
                            )
                          }
                          type="button"
                        >
                          {t("app.library.zoomIntoCluster")}
                        </button>
                        <div className="space-y-1">
                          {selectedGeoClusterPhotos.slice(0, 6).map((photo) => (
                            <button
                              className="flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-left text-sm hover:border-[var(--color-accent-strong)]"
                              key={photo.id}
                              onClick={() =>
                                setSelectedGeoTarget({
                                  id: photo.id,
                                  kind: "photo",
                                })
                              }
                              type="button"
                            >
                              <span className="font-medium text-[var(--color-text)]">
                                {photo.originalFilename}
                              </span>
                              <span className="text-xs text-[var(--color-text-muted)]">
                                {formatCoordinate(photo.latitude)},{" "}
                                {formatCoordinate(photo.longitude)}
                              </span>
                            </button>
                          ))}
                        </div>
                        {selectedGeoClusterPhotos.length > 6 ? (
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {t("app.library.clusterMore", {
                              count: countFormatter.format(
                                selectedGeoClusterPhotos.length - 6,
                              ),
                            })}
                          </p>
                        ) : null}
                      </div>
                    ) : selectedGeoPhoto ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">
                          {selectedGeoPhoto.originalFilename}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {t("app.library.photoSelected")} ·{" "}
                          {formatCoordinate(selectedGeoPhoto.latitude)},{" "}
                          {formatCoordinate(selectedGeoPhoto.longitude)}
                        </p>
                        <Link
                          className="button-secondary inline-flex py-1 text-sm"
                          to={`/app/library/photos/${selectedGeoPhoto.id}`}
                        >
                          {t("app.library.openPhotoDetail")}
                        </Link>
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {geoMapState.loading
                          ? t("app.library.loadingViewport")
                          : t("app.library.selectMarkerHint")}
                      </p>
                    )}
                  </div>
                </div>

                {!geoMapState.loading &&
                filteredGeoItems.length === 0 &&
                !geoMapState.errorMessage ? (
                  <div className="mt-4">
                    <EmptyState
                      action={
                        <div className="flex flex-wrap justify-center gap-3">
                          {normalizedLibraryFilter.length > 0 ? (
                            <button
                              className="button-secondary"
                              onClick={() => updateLibraryFilter("")}
                              type="button"
                            >
                              {t("common.clearFilter")}
                            </button>
                          ) : null}
                          <button
                            className="button-secondary"
                            onClick={() => setMapViewport(DEFAULT_GEO_VIEWPORT)}
                            type="button"
                          >
                            {t("app.library.resetWorldView")}
                          </button>
                        </div>
                      }
                      description={
                        geoTaggedPhotoCount === 0
                          ? t("app.library.noGeoPhotosDescription")
                          : normalizedLibraryFilter.length > 0
                            ? t("app.library.noGeoPhotosMatchDescription", {
                                filter: libraryFilter,
                              })
                            : t("app.library.noGeoPhotosViewportDescription")
                      }
                      title={
                        geoTaggedPhotoCount === 0
                          ? t("app.library.noGeoPhotosTitle")
                          : normalizedLibraryFilter.length > 0
                            ? t("app.library.noGeoPhotosMatchTitle")
                            : t("app.library.noGeoPhotosViewportTitle")
                      }
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div
                  className={`surface-dashed rounded-lg px-4 py-3 text-center transition ${
                    isUploadTargetActive
                      ? "dropzone-active"
                      : "bg-[var(--color-panel)]"
                  }`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsUploadTargetActive(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    if (
                      event.currentTarget.contains(
                        event.relatedTarget as Node | null,
                      )
                    ) {
                      return;
                    }
                    setIsUploadTargetActive(false);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsUploadTargetActive(true);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsUploadTargetActive(false);
                    void uploadSelectedFiles(
                      Array.from(event.dataTransfer.files),
                    );
                  }}
                >
                  {uploadProgress ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate text-sm font-medium text-[var(--color-text)]">
                          {uploadProgress.currentFileName ??
                            t("app.library.uploadingPhotos")}
                        </p>
                        <span className="shrink-0 text-xs tabular-nums text-[var(--color-text-muted)]">
                          {countFormatter.format(uploadProgress.completed)}/
                          {countFormatter.format(uploadProgress.total)}
                        </span>
                      </div>
                      <div className="upload-progress-track">
                        <div
                          className="upload-progress-bar"
                          style={{
                            width: `${Math.round((uploadProgress.completed / uploadProgress.total) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {t("app.library.dropzoneTitle")}
                    </p>
                  )}
                </div>

                {uploadError ? (
                  <InlineMessage className="mt-2" tone="danger">
                    {uploadError}
                  </InlineMessage>
                ) : null}

                {uploadSuccessMessage ? (
                  <InlineMessage className="mt-2" tone="success">
                    {uploadSuccessMessage}
                  </InlineMessage>
                ) : null}
              </>
            )}

            {photos.length === 0 ? (
              <EmptyState
                description={t("app.library.noPhotosDescription")}
                title={t("app.library.noPhotosTitle")}
              />
            ) : libraryView === "map" ? null : filteredPhotos.length === 0 ? (
              <EmptyState
                description={t("app.library.noPhotosMatchDescription")}
                title={t("app.library.noPhotosMatchTitle")}
              />
            ) : (
              <div className="space-y-6" id="library-photo-grid">
                {timelineGroups.map((group) => (
                  <section
                    className="scroll-mt-16"
                    id={buildDaySectionId(group.dayKey)}
                    key={group.dayKey}
                  >
                    <div className="flex items-baseline justify-between gap-3 pb-2">
                      <h3 className="text-sm font-semibold">
                        {formatDayLabel(group.dayKey, locale)}
                      </h3>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {formatRelativeCount(group.photos.length, photoForms)}
                      </span>
                    </div>

                    <div
                      className={`grid gap-3 ${
                        libraryView === "timeline"
                          ? "sm:grid-cols-2 xl:grid-cols-3"
                          : "sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                      }`}
                    >
                      {group.photos.map((photo) => (
                        <LibraryPhotoTile
                          isDeleteBusy={
                            pendingIntent === "delete-photo" &&
                            pendingPhotoId === photo.id
                          }
                          isFavorite={Boolean(photoFavorites[photo.id])}
                          isFavoriteBusy={
                            favoriteBusyKey === `photo:${photo.id}`
                          }
                          key={photo.id}
                          onFavoriteToggle={() => {
                            void handlePhotoFavoriteToggle(photo.id);
                          }}
                          photo={photo}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}

        {(libraryView === "photos" || libraryView === "timeline") && (
          <div className="xl:sticky xl:self-start" style={{ top: "3.5rem" }}>
            <div style={{ height: "calc(100vh - 6rem)" }}>
              <ProportionalTimelineRail
                locale={locale}
                markers={timelineMarkers}
                timelineGroups={timelineGroups}
              />
            </div>
            <div className="mt-2 text-xs text-[var(--color-text-muted)]">
              {countFormatter.format(filteredPhotos.length)}{" "}
              {formatRelativeCount(filteredPhotos.length, photoForms)} ·{" "}
              {countFormatter.format(timelineGroups.length)}{" "}
              {formatRelativeCount(timelineGroups.length, dayGroupForms)}
            </div>
          </div>
        )}

        {libraryView === "albums" && (
          <div className="space-y-4">
            {albumActionSuccess ? (
              <InlineMessage tone="success">{albumActionSuccess}</InlineMessage>
            ) : null}

            {albumSortMessage ? (
              <InlineMessage tone="danger">{albumSortMessage}</InlineMessage>
            ) : null}

            <Panel className="p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="eyebrow">{t("app.library.albumsEyebrow")}</p>
                  <h2 className="mt-1 text-sm font-semibold">
                    {t("app.library.albumsTitle")}
                  </h2>
                </div>
                <div className="rounded-[1.25rem] border border-dashed border-[var(--color-border)] px-4 py-3 text-sm leading-6 text-[var(--color-text-muted)] lg:max-w-md">
                  <p className="font-medium text-[var(--color-text)]">
                    {t("app.library.albumsSpacesTitle")}
                  </p>
                  <p className="mt-1">{t("app.library.albumsSpacesDescription")}</p>
                  <Link
                    className="mt-3 inline-flex text-sm font-medium text-[var(--color-link)] hover:text-[var(--color-link-hover)]"
                    to="/app/spaces"
                  >
                    {t("app.library.openSpaces")}
                  </Link>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2 sm:max-w-sm">
                <label
                  className="text-sm font-medium"
                  htmlFor="album-sort-select"
                >
                  {t("app.library.albumSortLabel")}
                </label>
                <select
                  className="field"
                  id="album-sort-select"
                  onChange={(event) => updateAlbumSort(event.target.value)}
                  value={buildAlbumSortOptionValue(
                    albumSortSelection.sort,
                    albumSortSelection.direction,
                  )}
                >
                  {ALBUM_SORT_OPTIONS.map((option) => (
                    <option
                      key={buildAlbumSortOptionValue(
                        option.sort,
                        option.direction,
                      )}
                      value={buildAlbumSortOptionValue(
                        option.sort,
                        option.direction,
                      )}
                    >
                      {t(option.labelKey as Parameters<typeof t>[0])}
                    </option>
                  ))}
                </select>
              </div>

              {albums.length === 0 ? (
                <EmptyHint className="mt-6 px-5 py-6 leading-7">
                  {t("app.library.noAlbums")}
                </EmptyHint>
              ) : filteredAlbums.length === 0 ? (
                <EmptyHint className="mt-6 px-5 py-6 leading-7">
                  {t("app.library.noAlbumsMatch")}
                </EmptyHint>
              ) : (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {filteredAlbums.map((album) => (
                    <AlbumTile
                      album={album}
                      isDeleteBusy={
                        pendingIntent === "delete-album" &&
                        pendingAlbumId === album.id
                      }
                      isDownloadBusy={downloadBusyAlbumId === album.id}
                      isFavorite={Boolean(albumFavorites[album.id])}
                      isFavoriteBusy={favoriteBusyKey === `album:${album.id}`}
                      isShareBusy={shareBusyAlbumId === album.id}
                      key={album.id}
                      locale={locale}
                      onDelete={() => {
                        setDeleteDialogAlbumId(album.id);
                        setAlbumActionError(null);
                        setAlbumActionSuccess(null);
                      }}
                      onEdit={() => {
                        openAlbumEditor(album);
                      }}
                      onFavoriteToggle={() => {
                        void handleAlbumFavoriteToggle(album.id);
                      }}
                      onShare={() => {
                        void openAlbumShareDialog(album);
                      }}
                      onDownload={() => {
                        void handleAlbumDownload(album);
                      }}
                      photoForms={photoForms}
                    />
                  ))}
                </div>
              )}
            </Panel>
          </div>
        )}
      </section>

      {isCreateAlbumOpen ? (
        <CreateAlbumDialog
          batchProgress={createBatchProgress}
          draft={createAlbumDraft}
          existingPhotos={filteredCreateLibraryPhotos}
          failures={createAlbumFailures}
          isBusy={isCreatingAlbum}
          isUploadTargetActive={isCreateUploadTargetActive}
          onClose={closeCreateAlbumDialog}
          onDraftChange={updateCreateAlbumDraft}
          onSubmit={() => {
            void handleCreateAlbumSubmit();
          }}
          onTogglePhoto={toggleCreateAlbumPhotoSelection}
          onUploadFiles={(files) => {
            void handleCreateAlbumUploads(files);
          }}
          onUploadTargetActiveChange={setIsCreateUploadTargetActive}
          partialAlbumId={partialCreatedAlbumId}
          selectedPhotoIds={createSelectedPhotoIds}
          submitError={createAlbumError}
          uploadError={createAlbumUploadError}
          uploadProgress={createUploadProgress}
        />
      ) : null}

      {editingAlbum ? (
        <AlbumEditDialog
          albumId={editingAlbum.id}
          draft={editAlbumDraft}
          onClose={() => {
            setEditingAlbumId(null);
          }}
          onDraftChange={updateEditAlbumDraft}
          pending={
            pendingIntent === "update-album" && pendingAlbumId === editingAlbum.id
          }
        />
      ) : null}

      {deleteDialogAlbum ? (
        <AlbumDeleteDialog
          album={deleteDialogAlbum}
          onClose={() => {
            setDeleteDialogAlbumId(null);
          }}
          pending={
            pendingIntent === "delete-album" &&
            pendingAlbumId === deleteDialogAlbum.id
          }
        />
      ) : null}

      {shareDialogAlbum ? (
        <AlbumShareDialog
          albumName={shareDialogAlbum.name}
          createdToken={shareDialogToken}
          errorMessage={shareDialogError}
          infoMessage={shareDialogInfo}
          isCreating={shareDialogCreating}
          isLoading={shareDialogLoading}
          links={shareDialogLinks}
          onClose={closeAlbumShareDialog}
          onCopyLink={(url) => {
            void copyTextToClipboard(
              url,
              t("app.albumShare.linkCopied"),
              t("app.albumShare.copyLinkFailed"),
            );
          }}
          onCopyToken={(token) => {
            void copyTextToClipboard(
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
