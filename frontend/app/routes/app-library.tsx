import type { Route } from "./+types/app-library";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Form,
  Link,
  useActionData,
  useNavigation,
  useRevalidator,
  useSearchParams,
} from "react-router";
import {
  Badge,
  EmptyHint,
  EmptyState,
  FilterToolbar,
  InlineMessage,
  PageHeader,
  Panel,
  SurfaceCard,
} from "~/components/ui";
import {
  ApiError,
  addFavorite,
  addPhotoToAlbum,
  createAlbum,
  deleteAlbum,
  deletePhoto,
  getPhotoBlob,
  listGeoPhotos,
  listAllAlbumPhotos,
  listAllPhotos,
  listAlbums,
  listFavorites,
  removeFavorite,
  removePhotoFromAlbum,
  updateAlbum,
  uploadPhoto,
} from "~/lib/api";
import { formatBytes, formatDateTime, formatRelativeCount } from "~/lib/format";
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
import type {
  AlbumDto,
  FavoriteDto,
  PhotoDto,
  PhotoGeoBounds,
} from "~/types/api";

interface AlbumWithPhotos extends AlbumDto {
  photos: PhotoDto[];
}

type LibraryView = "everything" | "photos" | "timeline" | "albums" | "map";
type TimelineGroup = {
  dayKey: string;
  photos: PhotoDto[];
};

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
  albums: AlbumWithPhotos[];
  photoFavorites: Record<string, FavoriteDto>;
  albumFavorites: Record<string, FavoriteDto>;
}

interface UploadProgressState {
  total: number;
  completed: number;
  currentFileName: string | null;
}

type LibraryActionResult =
  | {
      ok: true;
      intent:
        | "delete-photo"
        | "create-album"
        | "update-album"
        | "delete-album"
        | "add-photo-to-album"
        | "remove-photo-from-album";
      albumId?: string;
    }
  | {
      ok: false;
      intent:
        | "delete-photo"
        | "create-album"
        | "update-album"
        | "delete-album"
        | "add-photo-to-album"
        | "remove-photo-from-album";
      errorMessage: string;
    };

function buildAlbumEditorDrafts(albums: AlbumWithPhotos[]) {
  return Object.fromEntries(
    albums.map((album) => [
      album.id,
      {
        name: album.name,
        description: album.description ?? "",
      },
    ]),
  );
}

function buildAlbumPhotoSelection(albums: AlbumWithPhotos[]) {
  return Object.fromEntries(albums.map((album) => [album.id, ""]));
}

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

function dayKeyForPhoto(photo: PhotoDto) {
  const value = photo.takenAt ?? photo.createdAt;
  return value.slice(0, 10);
}

function resolveLibraryView(value: string | null): LibraryView {
  return value === "timeline" || value === "albums" || value === "map"
    ? value
    : "photos";
}

function formatCoordinate(value: number | null) {
  return value == null ? "—" : value.toFixed(4);
}

function buildDaySectionId(dayKey: string) {
  return `library-day-${dayKey}`;
}

function formatDayLabel(dayKey: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dayKey}T00:00:00Z`));
}

function formatDayChipLabel(dayKey: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  }).format(new Date(`${dayKey}T00:00:00Z`));
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
    <SurfaceCard className="overflow-hidden rounded-[1.5rem]">
      <Link
        aria-label={t("app.library.photoTileAria", {
          fileName: props.photo.originalFilename,
        })}
        className="block"
        to={`/app/library/photos/${props.photo.id}`}
      >
        <div className="preview-frame relative aspect-[4/3] overflow-hidden border-0 border-b border-[var(--color-border)]">
          {previewUrl ? (
            <img
              alt={t("app.library.photoPreviewAlt", {
                fileName: props.photo.originalFilename,
              })}
              className="h-full w-full object-cover"
              src={previewUrl}
            />
          ) : (
            <div className="preview-placeholder flex h-full items-end p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em]">
                  {props.photo.mimeType}
                </p>
                <p className="mt-1 text-base font-semibold tracking-tight text-[var(--color-text)]">
                  {props.photo.originalFilename}
                </p>
              </div>
            </div>
          )}

          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
            <Badge
              className="rounded-full px-3 py-1 text-xs font-semibold"
              tone="accent"
            >
              {capturedAt.slice(11, 16)}
            </Badge>
            {props.photo.latitude != null && props.photo.longitude != null ? (
              <Badge className="rounded-full px-3 py-1 text-xs font-semibold">
                {t("app.photoDetail.badgeGeotagged")}
              </Badge>
            ) : null}
          </div>
        </div>
      </Link>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              className="link-accent block truncate text-base font-semibold tracking-tight"
              to={`/app/library/photos/${props.photo.id}`}
            >
              {props.photo.originalFilename}
            </Link>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              {props.photo.width ?? "?"}x{props.photo.height ?? "?"} ·{" "}
              {props.photo.mimeType}
            </p>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            {props.isFavorite
              ? t("app.library.photoTileSaved")
              : t("app.library.photoTileLibrary")}
          </p>
        </div>

        <p className="text-sm text-[var(--color-text-muted)]">
          {formatBytes(props.photo.sizeBytes)} ·{" "}
          {formatDateTime(props.photo.takenAt ?? props.photo.createdAt)}
        </p>

        <div className="flex flex-wrap items-center gap-3 text-sm">
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
            className="link-accent font-semibold"
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
            className="text-link-danger font-semibold"
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
    </SurfaceCard>
  );
}

async function loadLibraryData(): Promise<LibraryLoaderData> {
  const [photos, albumList, photoFavoriteList, albumFavoriteList] =
    await Promise.all([
      listAllPhotos(),
      listAlbums(),
      listFavorites("PHOTO"),
      listFavorites("ALBUM"),
    ]);

  const albumPages = await Promise.all(
    albumList.map(async (album) => {
      const items = await listAllAlbumPhotos(album.id);
      return {
        ...album,
        photos: items,
      } satisfies AlbumWithPhotos;
    }),
  );

  return {
    photos,
    albums: albumPages,
    photoFavorites: Object.fromEntries(
      photoFavoriteList.map((favorite) => [favorite.targetId, favorite]),
    ),
    albumFavorites: Object.fromEntries(
      albumFavoriteList.map((favorite) => [favorite.targetId, favorite]),
    ),
  };
}

export async function clientLoader() {
  return loadLibraryData();
}

export async function clientAction({
  request,
}: Route.ClientActionArgs): Promise<LibraryActionResult> {
  const formData = await request.formData();
  const intent = resolveActionIntent(
    String(formData.get("intent") ?? ""),
    [
      "delete-photo",
      "create-album",
      "update-album",
      "delete-album",
      "add-photo-to-album",
      "remove-photo-from-album",
    ] as const,
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
      case "add-photo-to-album": {
        const albumId = String(formData.get("albumId") ?? "");
        await addPhotoToAlbum(albumId, String(formData.get("photoId") ?? ""));
        return { ok: true, intent, albumId };
      }
      case "remove-photo-from-album": {
        const albumId = String(formData.get("albumId") ?? "");
        await removePhotoFromAlbum(
          albumId,
          String(formData.get("photoId") ?? ""),
        );
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
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();
  const [photos, setPhotos] = useState<PhotoDto[]>(loaderData.photos);
  const [albums, setAlbums] = useState<AlbumWithPhotos[]>(loaderData.albums);
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
  const [albumDraft, setAlbumDraft] = useState({
    name: "",
    description: "",
  });
  const [albumEditorDrafts, setAlbumEditorDrafts] = useState<
    Record<string, { name: string; description: string }>
  >(buildAlbumEditorDrafts(loaderData.albums));
  const [albumPhotoSelection, setAlbumPhotoSelection] = useState<
    Record<string, string>
  >(buildAlbumPhotoSelection(loaderData.albums));
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

  const unassignedPhotosByAlbum = useMemo(() => {
    return Object.fromEntries(
      filteredAlbums.map((album) => [
        album.id,
        photos.filter(
          (photo) =>
            !album.photos.some((albumPhoto) => albumPhoto.id === photo.id),
        ),
      ]),
    ) as Record<string, PhotoDto[]>;
  }, [filteredAlbums, photos]);

  const timelineGroups = useMemo<TimelineGroup[]>(() => {
    const groups = new Map<string, PhotoDto[]>();

    for (const photo of filteredPhotos) {
      const dayKey = dayKeyForPhoto(photo);
      const bucket = groups.get(dayKey);
      if (bucket) {
        bucket.push(photo);
      } else {
        groups.set(dayKey, [photo]);
      }
    }

    return Array.from(groups.entries())
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([dayKey, groupPhotos]) => ({
        dayKey,
        photos: groupPhotos.sort((left, right) => {
          const leftDate = left.takenAt ?? left.createdAt;
          const rightDate = right.takenAt ?? right.createdAt;
          return rightDate.localeCompare(leftDate);
        }),
      }));
  }, [filteredPhotos]);
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
  const countFormatter = new Intl.NumberFormat(locale);
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
    startTransition(() => {
      setPhotos(loaderData.photos);
      setAlbums(loaderData.albums);
      setPhotoFavorites(loaderData.photoFavorites);
      setAlbumFavorites(loaderData.albumFavorites);
      setAlbumEditorDrafts(buildAlbumEditorDrafts(loaderData.albums));
      setAlbumPhotoSelection(buildAlbumPhotoSelection(loaderData.albums));
    });
  }, [loaderData]);

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
      setUploadError(null);
      setUploadSuccessMessage(null);
      if (actionData.intent === "create-album") {
        setAlbumDraft({ name: "", description: "" });
      }
      if (actionData.albumId) {
        setAlbumPhotoSelection((current) => ({
          ...current,
          [actionData.albumId!]: "",
        }));
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
      const nextData = await loadLibraryData();

      startTransition(() => {
        setPhotos(nextData.photos);
        setAlbums(nextData.albums);
        setPhotoFavorites(nextData.photoFavorites);
        setAlbumFavorites(nextData.albumFavorites);
        setAlbumEditorDrafts(
          Object.fromEntries(
            nextData.albums.map((album) => [
              album.id,
              {
                name: album.name,
                description: album.description ?? "",
              },
            ]),
          ),
        );
        setAlbumPhotoSelection(
          Object.fromEntries(nextData.albums.map((album) => [album.id, ""])),
        );
      });
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

  function updateAlbumDraft(
    albumId: string,
    field: "name" | "description",
    value: string,
  ) {
    setAlbumEditorDrafts((current) => ({
      ...current,
      [albumId]: {
        name: current[albumId]?.name ?? "",
        description: current[albumId]?.description ?? "",
        [field]: value,
      },
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

  return (
    <div className="space-y-8">
      <PageHeader
        description={t("app.library.description")}
        eyebrow={t("app.library.eyebrow")}
        title={t("app.library.title")}
      />

      <FilterToolbar
        className="p-3 sm:p-4"
        controls={
          <div className="flex w-full flex-col gap-4 lg:w-auto lg:flex-row lg:items-center">
            <div className="flex flex-wrap gap-2">
              {[
                { id: "photos", label: t("app.library.view.photos") },
                { id: "timeline", label: t("app.library.view.timeline") },
                { id: "map", label: t("app.library.view.map") },
                { id: "albums", label: t("app.library.view.albums") },
              ].map((option) => (
                <button
                  aria-pressed={libraryView === option.id}
                  className={
                    libraryView === option.id
                      ? "button-primary"
                      : "button-secondary"
                  }
                  key={option.id}
                  onClick={() => activateLibraryView(option.id as LibraryView)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
              <input
                aria-label={t("app.library.filterLabel")}
                className="field min-w-0 md:min-w-80"
                onChange={(event) => updateLibraryFilter(event.target.value)}
                placeholder={t("app.library.filterPlaceholder")}
                type="search"
                value={libraryFilter}
              />
              <button
                className="button-secondary"
                disabled={normalizedLibraryFilter.length === 0}
                onClick={() => updateLibraryFilter("")}
                type="button"
              >
                {t("common.clearFilter")}
              </button>
            </div>
          </div>
        }
        description={t("app.library.toolbarDescription")}
        title={t("app.library.toolbarTitle")}
      />

      {errorMessage ? (
        <Panel className="p-4">
          <p className="alert-danger">{errorMessage}</p>
        </Panel>
      ) : null}

      <section
        className={`grid gap-6 ${
          libraryView === "albums"
            ? "xl:grid-cols-[1.05fr_0.95fr]"
            : libraryView === "map"
              ? ""
              : "xl:grid-cols-[minmax(0,1fr)_15rem]"
        }`}
      >
        {(libraryView === "photos" ||
          libraryView === "timeline" ||
          libraryView === "map") && (
          <Panel className="p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="eyebrow">{t("app.library.photosEyebrow")}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  {libraryView === "timeline"
                    ? t("app.library.timelineTitle")
                    : libraryView === "map"
                      ? t("app.library.mapTitle")
                      : t("app.library.photosTitle")}
                </h2>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                  {libraryView === "map"
                    ? t("app.library.mapDescription")
                    : normalizedLibraryFilter.length === 0
                      ? t("app.library.visiblePhotosByDay", {
                          count: countFormatter.format(filteredPhotos.length),
                        })
                      : t("app.library.filteringDescription", {
                          filter: libraryFilter,
                        })}
                </p>
                {libraryView !== "map" ? (
                  <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                    {t("app.library.summaryLine", {
                      dayGroups: formatRelativeCount(
                        timelineGroups.length,
                        dayGroupForms,
                      ),
                      geoPhotos: formatRelativeCount(
                        geoTaggedPhotoCount,
                        geoPhotoForms,
                      ),
                    })}
                  </p>
                ) : null}
              </div>

              {libraryView === "map" ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    className="button-secondary"
                    disabled={selectedGeoTarget == null}
                    onClick={() => setSelectedGeoTarget(null)}
                    type="button"
                  >
                    {t("app.library.clearSelection")}
                  </button>
                  <button
                    className="button-secondary"
                    onClick={() => setMapViewport(DEFAULT_GEO_VIEWPORT)}
                    type="button"
                  >
                    {t("app.library.worldView")}
                  </button>
                  <button
                    className="button-secondary"
                    onClick={() =>
                      setMapViewport(zoomGeoViewport(geoViewport, "in"))
                    }
                    type="button"
                  >
                    {t("app.library.zoomIn")}
                  </button>
                  <button
                    className="button-secondary"
                    onClick={() =>
                      setMapViewport(zoomGeoViewport(geoViewport, "out"))
                    }
                    type="button"
                  >
                    {t("app.library.zoomOut")}
                  </button>
                </div>
              ) : (
                <label className="button-primary cursor-pointer">
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
              )}
            </div>

            {libraryView === "map" ? (
              <>
                <div className="mt-5 grid gap-3 lg:grid-cols-[0.72fr_0.28fr]">
                  <div className="space-y-3">
                    <SurfaceCard className="rounded-2xl px-4 py-3 text-sm text-[var(--color-text-muted)]">
                      <p className="font-semibold text-[var(--color-text)]">
                        {t("app.library.mapLegendTitle")}
                      </p>
                      <p className="mt-2">
                        {t("app.library.mapLegendDescription")}
                      </p>
                      {normalizedLibraryFilter.length > 0 ? (
                        <p className="mt-2">
                          {t("app.library.mapLegendFilter", {
                            filter: libraryFilter,
                          })}
                        </p>
                      ) : null}
                    </SurfaceCard>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="button-secondary"
                        onClick={() =>
                          setMapViewport(panGeoViewport(geoViewport, "west"))
                        }
                        type="button"
                      >
                        {t("app.library.panWest")}
                      </button>
                      <button
                        className="button-secondary"
                        onClick={() =>
                          setMapViewport(panGeoViewport(geoViewport, "east"))
                        }
                        type="button"
                      >
                        {t("app.library.panEast")}
                      </button>
                      <button
                        className="button-secondary"
                        onClick={() =>
                          setMapViewport(panGeoViewport(geoViewport, "north"))
                        }
                        type="button"
                      >
                        {t("app.library.panNorth")}
                      </button>
                      <button
                        className="button-secondary"
                        onClick={() =>
                          setMapViewport(panGeoViewport(geoViewport, "south"))
                        }
                        type="button"
                      >
                        {t("app.library.panSouth")}
                      </button>
                    </div>
                    <div className="map-shell rounded-3xl p-3">
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
                  <Panel className="p-4">
                    <p className="eyebrow">
                      {t("app.library.viewportEyebrow")}
                    </p>
                    <dl className="mt-3 space-y-2 text-sm text-[var(--color-text-muted)]">
                      <div className="flex justify-between gap-4">
                        <dt>{t("app.library.viewportSouthWest")}</dt>
                        <dd>
                          {geoViewport.swLat.toFixed(2)},{" "}
                          {geoViewport.swLng.toFixed(2)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>{t("app.library.viewportNorthEast")}</dt>
                        <dd>
                          {geoViewport.neLat.toFixed(2)},{" "}
                          {geoViewport.neLng.toFixed(2)}
                        </dd>
                      </div>
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
                      <SurfaceCard className="mt-5 space-y-3 rounded-2xl p-4">
                        <p className="text-sm font-semibold text-[var(--color-text)]">
                          {t("app.library.clusterTitle", {
                            count: countFormatter.format(
                              selectedGeoCluster.photos.length,
                            ),
                          })}
                        </p>
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                          {t("app.library.clusterHint")}
                        </p>
                        <button
                          className="button-secondary w-full"
                          onClick={() =>
                            setMapViewport(
                              zoomToClusterBounds(selectedGeoCluster.bounds),
                            )
                          }
                          type="button"
                        >
                          {t("app.library.zoomIntoCluster")}
                        </button>
                        <div className="space-y-2">
                          {selectedGeoClusterPhotos.slice(0, 6).map((photo) => (
                            <button
                              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] px-3 py-3 text-left hover:border-[var(--color-accent-strong)]"
                              key={photo.id}
                              onClick={() =>
                                setSelectedGeoTarget({
                                  id: photo.id,
                                  kind: "photo",
                                })
                              }
                              type="button"
                            >
                              <span className="text-sm font-semibold text-[var(--color-text)]">
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
                      </SurfaceCard>
                    ) : selectedGeoPhoto ? (
                      <SurfaceCard className="mt-5 space-y-3 rounded-2xl p-4">
                        <p className="text-sm font-semibold text-[var(--color-text)]">
                          {selectedGeoPhoto.originalFilename}
                        </p>
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                          {t("app.library.photoSelected")}
                        </p>
                        <dl className="space-y-2 text-sm text-[var(--color-text-muted)]">
                          <div className="flex justify-between gap-4">
                            <dt>{t("app.library.latitude")}</dt>
                            <dd>
                              {formatCoordinate(selectedGeoPhoto.latitude)}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt>{t("app.library.longitude")}</dt>
                            <dd>
                              {formatCoordinate(selectedGeoPhoto.longitude)}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt>{t("app.library.taken")}</dt>
                            <dd>
                              {formatDateTime(
                                selectedGeoPhoto.takenAt ??
                                  selectedGeoPhoto.createdAt,
                              )}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt>{t("app.library.viewportStatus")}</dt>
                            <dd>
                              {normalizedLibraryFilter.length === 0
                                ? t("app.library.visibleInViewport")
                                : t("app.library.visibleInViewportAndFilter")}
                            </dd>
                          </div>
                        </dl>
                        <Link
                          className="button-secondary inline-flex"
                          to={`/app/library/photos/${selectedGeoPhoto.id}`}
                        >
                          {t("app.library.openPhotoDetail")}
                        </Link>
                      </SurfaceCard>
                    ) : (
                      <EmptyHint className="mt-5 py-5">
                        {geoMapState.loading
                          ? t("app.library.loadingViewport")
                          : t("app.library.selectMarkerHint")}
                      </EmptyHint>
                    )}
                  </Panel>
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
                  className={`surface-dashed mt-5 rounded-3xl px-5 py-6 transition ${
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
                  <p className="text-sm font-semibold text-[var(--color-text)]">
                    {t("app.library.dropzoneTitle")}
                  </p>
                  <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                    {t("app.library.dropzoneDescription")}
                  </p>
                  {uploadProgress ? (
                    <p className="link-accent mt-3 text-sm font-semibold">
                      {t("app.library.uploadProgress", {
                        current: countFormatter.format(
                          uploadProgress.completed + 1,
                        ),
                        total: countFormatter.format(uploadProgress.total),
                        fileSuffix: uploadProgress.currentFileName
                          ? `: ${uploadProgress.currentFileName}`
                          : "",
                      })}
                    </p>
                  ) : null}
                </div>

                {uploadError ? (
                  <InlineMessage className="mt-4" tone="danger">
                    {uploadError}
                  </InlineMessage>
                ) : null}

                {uploadSuccessMessage ? (
                  <InlineMessage className="mt-4" tone="success">
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
              <div className="mt-6 space-y-8">
                {timelineGroups.map((group) => (
                  <section
                    className="scroll-mt-24"
                    id={buildDaySectionId(group.dayKey)}
                    key={group.dayKey}
                  >
                    <div className="flex flex-col gap-3 border-b border-[var(--color-border)] pb-4 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="eyebrow">{group.dayKey}</p>
                        <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                          {formatDayLabel(group.dayKey, locale)}
                        </h3>
                      </div>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {formatRelativeCount(group.photos.length, photoForms)}
                      </p>
                    </div>

                    <div
                      className={`mt-5 grid gap-4 ${
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
          </Panel>
        )}

        {(libraryView === "photos" || libraryView === "timeline") && (
          <div className="space-y-6">
            <Panel className="p-4 xl:sticky xl:top-4">
              <p className="eyebrow">{t("app.library.timelineRailEyebrow")}</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">
                {t("app.library.timelineRailTitle")}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
                {t("app.library.timelineRailDescription")}
              </p>

              <div className="mt-5 space-y-2">
                {timelineGroups.map((group) => (
                  <button
                    className="surface-card-subtle flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition-transform duration-150 hover:-translate-y-0.5"
                    key={group.dayKey}
                    onClick={() => {
                      document
                        .getElementById(buildDaySectionId(group.dayKey))
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                    }}
                    type="button"
                  >
                    <span>
                      <span className="block text-sm font-semibold">
                        {formatDayChipLabel(group.dayKey, locale)}
                      </span>
                      <span className="mt-1 block text-xs text-[var(--color-text-muted)]">
                        {group.dayKey}
                      </span>
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {group.photos.length}
                    </span>
                  </button>
                ))}
              </div>

              <SurfaceCard className="mt-5 rounded-2xl p-4" tone="subtle">
                <p className="eyebrow">{t("app.library.atGlanceEyebrow")}</p>
                <dl className="mt-3 space-y-2 text-sm text-[var(--color-text-muted)]">
                  <div className="flex items-center justify-between gap-3">
                    <dt>{t("app.library.atGlanceVisiblePhotos")}</dt>
                    <dd className="font-semibold text-[var(--color-text)]">
                      {countFormatter.format(filteredPhotos.length)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt>{t("app.library.atGlanceDayGroups")}</dt>
                    <dd className="font-semibold text-[var(--color-text)]">
                      {countFormatter.format(timelineGroups.length)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt>{t("app.library.atGlanceAlbums")}</dt>
                    <dd className="font-semibold text-[var(--color-text)]">
                      {countFormatter.format(filteredAlbums.length)}
                    </dd>
                  </div>
                </dl>

                <button
                  className="button-secondary mt-4 w-full"
                  onClick={() => activateLibraryView("albums")}
                  type="button"
                >
                  {t("app.library.openAlbums")}
                </button>
              </SurfaceCard>
            </Panel>
          </div>
        )}

        {libraryView === "albums" && (
          <div className="space-y-6">
            <Panel className="p-6">
              <p className="eyebrow">{t("app.library.createAlbumEyebrow")}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                {t("app.library.createAlbumTitle")}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
                {t("app.library.createAlbumDescription")}
              </p>

              <Form className="mt-5 space-y-4" method="post">
                <input name="intent" type="hidden" value="create-album" />
                <label className="block">
                  <span className="mb-2 block text-sm font-medium">
                    {t("common.name")}
                  </span>
                  <input
                    className="field"
                    name="name"
                    onChange={(event) =>
                      setAlbumDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    required
                    value={albumDraft.name}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium">
                    {t("common.description")}
                  </span>
                  <textarea
                    className="field min-h-28 resize-y"
                    name="description"
                    onChange={(event) =>
                      setAlbumDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    value={albumDraft.description}
                  />
                </label>

                {albumActionError ? (
                  <InlineMessage tone="danger">
                    {albumActionError}
                  </InlineMessage>
                ) : null}

                <button
                  className="button-primary w-full"
                  disabled={pendingIntent === "create-album"}
                  type="submit"
                >
                  {pendingIntent === "create-album"
                    ? t("common.creating")
                    : t("app.library.createAlbumSubmit")}
                </button>
              </Form>
            </Panel>

            <SurfaceCard className="rounded-3xl p-5" tone="subtle">
              <p className="eyebrow">{t("app.library.albumsSpacesEyebrow")}</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">
                {t("app.library.albumsSpacesTitle")}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
                {t("app.library.albumsSpacesDescription")}
              </p>
              <Link className="button-secondary mt-4 w-full" to="/app/spaces">
                {t("app.library.openSpaces")}
              </Link>
            </SurfaceCard>

            <Panel className="p-6">
              <p className="eyebrow">{t("app.library.albumsEyebrow")}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                {t("app.library.albumsTitle")}
              </h2>

              {albums.length === 0 ? (
                <EmptyHint className="mt-6 px-5 py-6 leading-7">
                  {t("app.library.noAlbums")}
                </EmptyHint>
              ) : filteredAlbums.length === 0 ? (
                <EmptyHint className="mt-6 px-5 py-6 leading-7">
                  {t("app.library.noAlbumsMatch")}
                </EmptyHint>
              ) : (
                <div className="mt-6 space-y-4">
                  {filteredAlbums.map((album) => {
                    const draft = albumEditorDrafts[album.id] ?? {
                      name: album.name,
                      description: album.description ?? "",
                    };
                    const availablePhotos =
                      unassignedPhotosByAlbum[album.id] ?? [];

                    return (
                      <SurfaceCard className="rounded-2xl p-4" key={album.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="eyebrow">
                              {t("app.library.albumEyebrow")}
                            </p>
                            <h3 className="mt-1 text-lg font-semibold tracking-tight">
                              {album.name}
                            </h3>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              aria-label={
                                albumFavorites[album.id]
                                  ? t("app.library.removeAlbumFavoriteAria", {
                                      albumName: album.name,
                                    })
                                  : t("app.library.addAlbumFavoriteAria", {
                                      albumName: album.name,
                                    })
                              }
                              className="link-accent text-sm font-semibold"
                              disabled={favoriteBusyKey === `album:${album.id}`}
                              onClick={() => {
                                void handleAlbumFavoriteToggle(album.id);
                              }}
                              type="button"
                            >
                              {favoriteBusyKey === `album:${album.id}`
                                ? t("common.updating")
                                : albumFavorites[album.id]
                                  ? t("common.unfavorite")
                                  : t("common.favorite")}
                            </button>
                            <button
                              className="text-link-danger text-sm font-semibold"
                              disabled={
                                pendingIntent === "delete-album" &&
                                pendingAlbumId === album.id
                              }
                              form={`delete-album-${album.id}`}
                              type="submit"
                            >
                              {pendingIntent === "delete-album" &&
                              pendingAlbumId === album.id
                                ? t("common.deleting")
                                : t("common.delete")}
                            </button>
                            <Form id={`delete-album-${album.id}`} method="post">
                              <input
                                name="intent"
                                type="hidden"
                                value="delete-album"
                              />
                              <input
                                name="albumId"
                                type="hidden"
                                value={album.id}
                              />
                            </Form>
                          </div>
                        </div>

                        <Form className="mt-4 space-y-3" method="post">
                          <input
                            name="intent"
                            type="hidden"
                            value="update-album"
                          />
                          <input
                            name="albumId"
                            type="hidden"
                            value={album.id}
                          />
                          <input
                            className="field"
                            name="name"
                            onChange={(event) => {
                              updateAlbumDraft(
                                album.id,
                                "name",
                                event.target.value,
                              );
                            }}
                            value={draft.name}
                          />
                          <textarea
                            className="field min-h-24 resize-y"
                            name="description"
                            onChange={(event) => {
                              updateAlbumDraft(
                                album.id,
                                "description",
                                event.target.value,
                              );
                            }}
                            value={draft.description}
                          />
                          <button
                            className="button-secondary w-full"
                            disabled={
                              pendingIntent === "update-album" &&
                              pendingAlbumId === album.id
                            }
                            type="submit"
                          >
                            {pendingIntent === "update-album" &&
                            pendingAlbumId === album.id
                              ? t("common.saving")
                              : t("app.library.saveAlbum")}
                          </button>
                        </Form>

                        <div className="mt-5 space-y-3">
                          <Form className="flex gap-3" method="post">
                            <input
                              name="intent"
                              type="hidden"
                              value="add-photo-to-album"
                            />
                            <input
                              name="albumId"
                              type="hidden"
                              value={album.id}
                            />
                            <select
                              aria-label={t("app.library.photoForAlbumAria", {
                                albumName: album.name,
                              })}
                              className="field"
                              disabled={availablePhotos.length === 0}
                              name="photoId"
                              onChange={(event) =>
                                setAlbumPhotoSelection((current) => ({
                                  ...current,
                                  [album.id]: event.target.value,
                                }))
                              }
                              value={albumPhotoSelection[album.id] ?? ""}
                            >
                              <option value="">
                                {t("app.library.selectPhotoToAdd")}
                              </option>
                              {availablePhotos.map((photo) => (
                                <option key={photo.id} value={photo.id}>
                                  {photo.originalFilename}
                                </option>
                              ))}
                            </select>
                            {availablePhotos.length === 0 ? (
                              <p className="text-sm text-[var(--color-text-muted)]">
                                {t("app.library.allPhotosAssigned")}
                              </p>
                            ) : null}
                            <button
                              className="button-secondary shrink-0"
                              disabled={
                                !albumPhotoSelection[album.id] ||
                                (pendingIntent === "add-photo-to-album" &&
                                  pendingAlbumId === album.id)
                              }
                              type="submit"
                            >
                              {t("common.add")}
                            </button>
                          </Form>

                          {album.photos.length === 0 ? (
                            <p className="text-sm text-[var(--color-text-muted)]">
                              {t("app.library.noPhotosInAlbum")}
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {album.photos.map((photo) => (
                                <div
                                  key={photo.id}
                                  className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] px-3 py-3"
                                >
                                  <div>
                                    <p className="text-sm font-semibold">
                                      {photo.originalFilename}
                                    </p>
                                    <p className="text-xs text-[var(--color-text-muted)]">
                                      {formatBytes(photo.sizeBytes)}
                                    </p>
                                  </div>
                                  <button
                                    className="text-link-danger text-sm font-semibold"
                                    disabled={
                                      pendingIntent ===
                                        "remove-photo-from-album" &&
                                      pendingAlbumId === album.id &&
                                      pendingPhotoId === photo.id
                                    }
                                    form={`remove-photo-${album.id}-${photo.id}`}
                                    type="submit"
                                  >
                                    {t("common.remove")}
                                  </button>
                                  <Form
                                    id={`remove-photo-${album.id}-${photo.id}`}
                                    method="post"
                                  >
                                    <input
                                      name="intent"
                                      type="hidden"
                                      value="remove-photo-from-album"
                                    />
                                    <input
                                      name="albumId"
                                      type="hidden"
                                      value={album.id}
                                    />
                                    <input
                                      name="photoId"
                                      type="hidden"
                                      value={photo.id}
                                    />
                                  </Form>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </SurfaceCard>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>
        )}
      </section>
    </div>
  );
}
