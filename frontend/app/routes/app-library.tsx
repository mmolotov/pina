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
import { EmptyState, PageHeader, Panel } from "~/components/ui";
import {
  ApiError,
  addFavorite,
  addPhotoToAlbum,
  createAlbum,
  deleteAlbum,
  deletePhoto,
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
import { formatBytes, formatDateTime } from "~/lib/format";
import {
  applyGeoViewportToSearchParams,
  buildGeoClusters,
  DEFAULT_GEO_VIEWPORT,
  panGeoViewport,
  parseGeoViewportFromSearchParams,
  zoomToClusterBounds,
  zoomGeoViewport,
} from "~/lib/geo";
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

function formatUploadSummary(uploadedCount: number, totalCount: number) {
  if (uploadedCount === totalCount) {
    return uploadedCount === 1
      ? "Uploaded 1 photo."
      : `Uploaded ${uploadedCount} photos.`;
  }

  return `Uploaded ${uploadedCount} of ${totalCount} photos.`;
}

function dayKeyForPhoto(photo: PhotoDto) {
  const value = photo.takenAt ?? photo.createdAt;
  return value.slice(0, 10);
}

function resolveLibraryView(value: string | null): LibraryView {
  return value === "photos" ||
    value === "timeline" ||
    value === "albums" ||
    value === "map"
    ? value
    : "everything";
}

function formatCoordinate(value: number | null) {
  return value == null ? "—" : value.toFixed(4);
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
          errorMessage: "Unknown library action.",
        };
    }
  } catch (error) {
    return {
      ok: false,
      intent,
      errorMessage: toActionErrorMessage(error, "Library action failed."),
    };
  }
}

export default function AppLibraryRoute({ loaderData }: Route.ComponentProps) {
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
  const [libraryFilter, setLibraryFilter] = useState("");
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

  useEffect(() => {
    setLibraryView(resolveLibraryView(searchParams.get("view")));
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
              : "Failed to load map photos.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [deferredGeoViewport, libraryView]);

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
        error instanceof Error ? error.message : "Failed to load library.",
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
      setUploadError("Only JPEG and PNG files are supported.");
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
              : `${file.name}: Photo upload failed.`,
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
          formatUploadSummary(uploadedCount, supportedFiles.length),
        );
      }

      if (failedUploads.length > 0) {
        setUploadError(failedUploads.join(" "));
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setUploadError(error.message);
      } else {
        setUploadError("Photo upload failed.");
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
        setAlbumActionError("Failed to update photo favorite.");
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
        setAlbumActionError("Failed to update album favorite.");
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
    if (nextView === "everything") {
      nextParams.delete("view");
    } else {
      nextParams.set("view", nextView);
    }

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

  return (
    <div className="space-y-8">
      <PageHeader
        description="This route now performs real upload, delete, album management, and favorite operations against the Phase 2 backend."
        eyebrow="Personal Library"
        title="Photos and albums"
      />

      <Panel className="p-3 sm:p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "everything", label: "Everything" },
              { id: "photos", label: "Photos only" },
              { id: "timeline", label: "Timeline" },
              { id: "map", label: "Map" },
              { id: "albums", label: "Albums only" },
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
              aria-label="Filter library"
              className="field min-w-0 md:min-w-80"
              onChange={(event) => setLibraryFilter(event.target.value)}
              placeholder="Filter photos and albums by name"
              type="search"
              value={libraryFilter}
            />
            <button
              className="button-secondary"
              disabled={normalizedLibraryFilter.length === 0}
              onClick={() => setLibraryFilter("")}
              type="button"
            >
              Clear filter
            </button>
          </div>
        </div>
      </Panel>

      <section className="grid gap-4 md:grid-cols-4">
        <Panel className="p-5">
          <p className="eyebrow">Visible photos</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">
            {filteredPhotos.length}
          </p>
        </Panel>
        <Panel className="p-5">
          <p className="eyebrow">Visible albums</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">
            {filteredAlbums.length}
          </p>
        </Panel>
        <Panel className="p-5">
          <p className="eyebrow">Geo-tagged photos</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">
            {geoTaggedPhotoCount}
          </p>
        </Panel>
        <Panel className="p-5">
          <p className="eyebrow">Current filter</p>
          <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
            {normalizedLibraryFilter.length === 0
              ? "Showing the full personal library."
              : `Filtering by "${libraryFilter}".`}
          </p>
        </Panel>
      </section>

      {errorMessage ? (
        <Panel className="p-4">
          <p className="text-sm text-[var(--color-danger)]">{errorMessage}</p>
        </Panel>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        {(libraryView === "everything" ||
          libraryView === "photos" ||
          libraryView === "timeline" ||
          libraryView === "map") && (
          <Panel className="p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="eyebrow">Photos</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  {libraryView === "timeline"
                    ? "Photo timeline"
                    : libraryView === "map"
                      ? "Geo map"
                      : "Current uploads"}
                </h2>
                {libraryView === "map" ? (
                  <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                    Browse geo-tagged personal photos by the current viewport.
                    The map state is restored from the URL for refresh and deep
                    links.
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
                    Clear selection
                  </button>
                  <button
                    className="button-secondary"
                    onClick={() => setMapViewport(DEFAULT_GEO_VIEWPORT)}
                    type="button"
                  >
                    World view
                  </button>
                  <button
                    className="button-secondary"
                    onClick={() =>
                      setMapViewport(zoomGeoViewport(geoViewport, "in"))
                    }
                    type="button"
                  >
                    Zoom in
                  </button>
                  <button
                    className="button-secondary"
                    onClick={() =>
                      setMapViewport(zoomGeoViewport(geoViewport, "out"))
                    }
                    type="button"
                  >
                    Zoom out
                  </button>
                </div>
              ) : (
                <label className="button-primary cursor-pointer">
                  <input
                    accept="image/jpeg,image/png"
                    aria-label="Upload photos"
                    className="hidden"
                    disabled={uploadingPhoto}
                    multiple
                    onChange={handlePhotoUpload}
                    type="file"
                  />
                  {uploadingPhoto ? "Uploading..." : "Upload photos"}
                </label>
              )}
            </div>

            {libraryView === "map" ? (
              <>
                <div className="mt-5 grid gap-3 lg:grid-cols-[0.72fr_0.28fr]">
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
                      <p className="font-semibold text-[var(--color-text)]">
                        Map legend
                      </p>
                      <p className="mt-2">
                        Small markers represent a single photo. Numbered markers
                        represent clusters; zoom in or select the cluster to
                        inspect the assets inside it.
                      </p>
                      {normalizedLibraryFilter.length > 0 ? (
                        <p className="mt-2">
                          Current filter applies to map markers too: &quot;
                          {libraryFilter}&quot;.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="button-secondary"
                        onClick={() =>
                          setMapViewport(panGeoViewport(geoViewport, "west"))
                        }
                        type="button"
                      >
                        Pan west
                      </button>
                      <button
                        className="button-secondary"
                        onClick={() =>
                          setMapViewport(panGeoViewport(geoViewport, "east"))
                        }
                        type="button"
                      >
                        Pan east
                      </button>
                      <button
                        className="button-secondary"
                        onClick={() =>
                          setMapViewport(panGeoViewport(geoViewport, "north"))
                        }
                        type="button"
                      >
                        Pan north
                      </button>
                      <button
                        className="button-secondary"
                        onClick={() =>
                          setMapViewport(panGeoViewport(geoViewport, "south"))
                        }
                        type="button"
                      >
                        Pan south
                      </button>
                    </div>
                    <div className="rounded-3xl border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(203,227,236,0.88)_0%,rgba(201,225,215,0.78)_55%,rgba(229,217,185,0.88)_100%)] p-3">
                      <div className="relative min-h-[28rem] overflow-hidden rounded-[1.25rem] border border-[rgba(0,0,0,0.08)] bg-[linear-gradient(90deg,rgba(255,255,255,0.28)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.28)_1px,transparent_1px)] bg-[size:12.5%_12.5%]">
                        {geoMapState.loading ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-[rgba(247,244,236,0.72)] text-sm font-semibold text-[var(--color-text-muted)]">
                            Loading map markers...
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
                                  ? `Open map cluster with ${cluster.photos.length} photos`
                                  : `Open map marker for ${leadPhoto.originalFilename}`
                              }
                              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm transition ${
                                isCluster
                                  ? "min-h-8 min-w-8 px-2 text-xs font-semibold"
                                  : "h-4 w-4"
                              } ${
                                isSelected
                                  ? "bg-[var(--color-primary-strong)] text-white ring-4 ring-[rgba(150,93,52,0.18)]"
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
                    <p className="eyebrow">Viewport</p>
                    <dl className="mt-3 space-y-2 text-sm text-[var(--color-text-muted)]">
                      <div className="flex justify-between gap-4">
                        <dt>South-west</dt>
                        <dd>
                          {geoViewport.swLat.toFixed(2)},{" "}
                          {geoViewport.swLng.toFixed(2)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>North-east</dt>
                        <dd>
                          {geoViewport.neLat.toFixed(2)},{" "}
                          {geoViewport.neLng.toFixed(2)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Markers</dt>
                        <dd>{geoClusters.length}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Photos in view</dt>
                        <dd>{filteredGeoItems.length}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Selection</dt>
                        <dd>
                          {selectedGeoCluster &&
                          selectedGeoCluster.photos.length > 1
                            ? `${selectedGeoCluster.photos.length} photo cluster`
                            : selectedGeoPhoto
                              ? "Single photo"
                              : "Nothing selected"}
                        </dd>
                      </div>
                    </dl>

                    {geoMapState.errorMessage ? (
                      <p className="mt-4 rounded-2xl border border-[rgba(161,69,63,0.25)] bg-[rgba(161,69,63,0.08)] px-4 py-3 text-sm text-[var(--color-danger)]">
                        {geoMapState.errorMessage}
                      </p>
                    ) : null}

                    {selectedGeoCluster &&
                    selectedGeoCluster.photos.length > 1 ? (
                      <div className="mt-5 space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel-strong)] p-4">
                        <p className="text-sm font-semibold text-[var(--color-text)]">
                          Cluster of {selectedGeoCluster.photos.length} photos
                        </p>
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                          Zoom in to reveal individual assets
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
                          Zoom into cluster
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
                            {selectedGeoClusterPhotos.length - 6} more photos
                            are still inside this cluster. Zoom in to split it
                            into smaller groups.
                          </p>
                        ) : null}
                      </div>
                    ) : selectedGeoPhoto ? (
                      <div className="mt-5 space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel-strong)] p-4">
                        <p className="text-sm font-semibold text-[var(--color-text)]">
                          {selectedGeoPhoto.originalFilename}
                        </p>
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                          Photo selected
                        </p>
                        <dl className="space-y-2 text-sm text-[var(--color-text-muted)]">
                          <div className="flex justify-between gap-4">
                            <dt>Latitude</dt>
                            <dd>
                              {formatCoordinate(selectedGeoPhoto.latitude)}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt>Longitude</dt>
                            <dd>
                              {formatCoordinate(selectedGeoPhoto.longitude)}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt>Taken</dt>
                            <dd>
                              {formatDateTime(
                                selectedGeoPhoto.takenAt ??
                                  selectedGeoPhoto.createdAt,
                              )}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt>Viewport status</dt>
                            <dd>
                              {normalizedLibraryFilter.length === 0
                                ? "Visible in current map view"
                                : "Visible in current map view and filter"}
                            </dd>
                          </div>
                        </dl>
                        <Link
                          className="button-secondary inline-flex"
                          to={`/app/library/photos/${selectedGeoPhoto.id}`}
                        >
                          Open photo detail
                        </Link>
                      </div>
                    ) : (
                      <div className="mt-5 rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-5 text-sm text-[var(--color-text-muted)]">
                        {geoMapState.loading
                          ? "Loading the current viewport."
                          : "Select a marker to inspect the photo and jump to the detail screen."}
                      </div>
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
                              onClick={() => setLibraryFilter("")}
                              type="button"
                            >
                              Clear filter
                            </button>
                          ) : null}
                          <button
                            className="button-secondary"
                            onClick={() => setMapViewport(DEFAULT_GEO_VIEWPORT)}
                            type="button"
                          >
                            Reset to world view
                          </button>
                        </div>
                      }
                      description={
                        geoTaggedPhotoCount === 0
                          ? "Only photos with EXIF GPS coordinates appear on the map. Upload or import photos that contain location metadata to start browsing them here."
                          : normalizedLibraryFilter.length > 0
                            ? `No geo-tagged photos match "${libraryFilter}" in the current viewport. Clear the filter or widen the map.`
                            : "Try widening the viewport or resetting to the world view. Only photos with EXIF GPS coordinates appear on the map."
                      }
                      title={
                        geoTaggedPhotoCount === 0
                          ? "No geo-tagged photos yet"
                          : normalizedLibraryFilter.length > 0
                            ? "No geo-tagged photos match the current filter"
                            : "No geo-tagged photos in this viewport"
                      }
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div
                  className={`mt-5 rounded-3xl border border-dashed px-5 py-6 transition ${
                    isUploadTargetActive
                      ? "border-[var(--color-accent)] bg-[rgba(190,138,43,0.12)]"
                      : "border-[var(--color-border)] bg-[var(--color-panel)]"
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
                    Drop JPEG or PNG files here to upload them in a batch.
                  </p>
                  <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                    The current frontend uploads files sequentially against the
                    Phase 2 photo endpoint and refreshes the library once the
                    queue finishes.
                  </p>
                  {uploadProgress ? (
                    <p className="mt-3 text-sm text-[var(--color-primary-strong)]">
                      Uploading {uploadProgress.completed + 1} of{" "}
                      {uploadProgress.total}
                      {uploadProgress.currentFileName
                        ? `: ${uploadProgress.currentFileName}`
                        : ""}
                    </p>
                  ) : null}
                </div>

                {uploadError ? (
                  <p className="mt-4 rounded-2xl border border-[rgba(161,69,63,0.25)] bg-[rgba(161,69,63,0.08)] px-4 py-3 text-sm text-[var(--color-danger)]">
                    {uploadError}
                  </p>
                ) : null}

                {uploadSuccessMessage ? (
                  <p className="mt-4 rounded-2xl border border-[rgba(43,112,72,0.24)] bg-[rgba(43,112,72,0.09)] px-4 py-3 text-sm text-[rgb(43,112,72)]">
                    {uploadSuccessMessage}
                  </p>
                ) : null}
              </>
            )}

            {photos.length === 0 ? (
              <EmptyState
                description="Upload your first JPEG or PNG. The route now performs a real multipart upload against the backend."
                title="No photos uploaded"
              />
            ) : libraryView === "map" ? null : filteredPhotos.length === 0 ? (
              <EmptyState
                description="Try a different filename fragment or clear the current filter to see the rest of the library."
                title="No photos match the current filter"
              />
            ) : libraryView === "timeline" ? (
              <div className="mt-6 space-y-6">
                {timelineGroups.map((group) => (
                  <section key={group.dayKey}>
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
                      <div>
                        <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-text-muted)]">
                          {group.dayKey}
                        </p>
                        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                          {group.photos.length}{" "}
                          {group.photos.length === 1 ? "photo" : "photos"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {group.photos.map((photo) => (
                        <article
                          key={photo.id}
                          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel-strong)] p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <Link
                                className="text-lg font-semibold tracking-tight hover:text-[var(--color-primary-strong)]"
                                to={`/app/library/photos/${photo.id}`}
                              >
                                {photo.originalFilename}
                              </Link>
                              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                                {photoFavorites[photo.id]
                                  ? "Favorited"
                                  : "Not favorited"}
                              </p>
                            </div>
                            <span className="rounded-full bg-[rgba(150,93,52,0.12)] px-3 py-1 text-xs font-semibold text-[var(--color-primary-strong)]">
                              {(photo.takenAt ?? photo.createdAt).slice(11, 16)}
                            </span>
                          </div>

                          <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                            {photo.width ?? "?"}x{photo.height ?? "?"} ·{" "}
                            {formatBytes(photo.sizeBytes)}
                          </p>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {filteredPhotos.map((photo) => (
                  <article
                    key={photo.id}
                    className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel-strong)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          className="text-lg font-semibold tracking-tight hover:text-[var(--color-primary-strong)]"
                          to={`/app/library/photos/${photo.id}`}
                        >
                          {photo.originalFilename}
                        </Link>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                          {photoFavorites[photo.id]
                            ? "Favorited"
                            : "Not favorited"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          aria-label={
                            photoFavorites[photo.id]
                              ? `Remove ${photo.originalFilename} from favorites`
                              : `Add ${photo.originalFilename} to favorites`
                          }
                          className="text-sm font-semibold text-[var(--color-primary-strong)]"
                          disabled={favoriteBusyKey === `photo:${photo.id}`}
                          onClick={() => {
                            void handlePhotoFavoriteToggle(photo.id);
                          }}
                          type="button"
                        >
                          {favoriteBusyKey === `photo:${photo.id}`
                            ? "Updating..."
                            : photoFavorites[photo.id]
                              ? "Unfavorite"
                              : "Favorite"}
                        </button>
                        <button
                          className="text-sm font-semibold text-[var(--color-danger)]"
                          disabled={
                            pendingIntent === "delete-photo" &&
                            pendingPhotoId === photo.id
                          }
                          form={`delete-photo-${photo.id}`}
                          type="submit"
                        >
                          {pendingIntent === "delete-photo" &&
                          pendingPhotoId === photo.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                        <Form id={`delete-photo-${photo.id}`} method="post">
                          <input
                            name="intent"
                            type="hidden"
                            value="delete-photo"
                          />
                          <input
                            name="photoId"
                            type="hidden"
                            value={photo.id}
                          />
                        </Form>
                      </div>
                    </div>

                    <dl className="mt-3 space-y-2 text-sm text-[var(--color-text-muted)]">
                      <div className="flex justify-between gap-4">
                        <dt>MIME</dt>
                        <dd>{photo.mimeType}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Dimensions</dt>
                        <dd>
                          {photo.width ?? "?"}x{photo.height ?? "?"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Size</dt>
                        <dd>{formatBytes(photo.sizeBytes)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Created</dt>
                        <dd>{formatDateTime(photo.createdAt)}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            )}
          </Panel>
        )}

        {(libraryView === "everything" || libraryView === "albums") && (
          <div className="space-y-6">
            <Panel className="p-6">
              <p className="eyebrow">Create album</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                New collection
              </h2>

              <Form className="mt-5 space-y-4" method="post">
                <input name="intent" type="hidden" value="create-album" />
                <label className="block">
                  <span className="mb-2 block text-sm font-medium">Name</span>
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
                    Description
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
                  <p className="rounded-2xl border border-[rgba(161,69,63,0.25)] bg-[rgba(161,69,63,0.08)] px-4 py-3 text-sm text-[var(--color-danger)]">
                    {albumActionError}
                  </p>
                ) : null}

                <button
                  className="button-primary w-full"
                  disabled={pendingIntent === "create-album"}
                  type="submit"
                >
                  {pendingIntent === "create-album"
                    ? "Creating..."
                    : "Create album"}
                </button>
              </Form>
            </Panel>

            <Panel className="p-6">
              <p className="eyebrow">Albums</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Organized collections
              </h2>

              {albums.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-[var(--color-border)] px-5 py-6 text-sm leading-7 text-[var(--color-text-muted)]">
                  No albums yet. Use the form above to create one.
                </div>
              ) : filteredAlbums.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-[var(--color-border)] px-5 py-6 text-sm leading-7 text-[var(--color-text-muted)]">
                  No albums match the current filter.
                </div>
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
                      <article
                        key={album.id}
                        className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel-strong)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="eyebrow">Album</p>
                            <h3 className="mt-1 text-lg font-semibold tracking-tight">
                              {album.name}
                            </h3>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              aria-label={
                                albumFavorites[album.id]
                                  ? `Remove ${album.name} from favorites`
                                  : `Add ${album.name} to favorites`
                              }
                              className="text-sm font-semibold text-[var(--color-primary-strong)]"
                              disabled={favoriteBusyKey === `album:${album.id}`}
                              onClick={() => {
                                void handleAlbumFavoriteToggle(album.id);
                              }}
                              type="button"
                            >
                              {favoriteBusyKey === `album:${album.id}`
                                ? "Updating..."
                                : albumFavorites[album.id]
                                  ? "Unfavorite"
                                  : "Favorite"}
                            </button>
                            <button
                              className="text-sm font-semibold text-[var(--color-danger)]"
                              disabled={
                                pendingIntent === "delete-album" &&
                                pendingAlbumId === album.id
                              }
                              form={`delete-album-${album.id}`}
                              type="submit"
                            >
                              {pendingIntent === "delete-album" &&
                              pendingAlbumId === album.id
                                ? "Deleting..."
                                : "Delete"}
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
                              ? "Saving..."
                              : "Save album"}
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
                              aria-label={`Photo for album ${album.name}`}
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
                              <option value="">Select photo to add</option>
                              {availablePhotos.map((photo) => (
                                <option key={photo.id} value={photo.id}>
                                  {photo.originalFilename}
                                </option>
                              ))}
                            </select>
                            {availablePhotos.length === 0 ? (
                              <p className="text-sm text-[var(--color-text-muted)]">
                                All available photos are already assigned to
                                this album.
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
                              Add
                            </button>
                          </Form>

                          {album.photos.length === 0 ? (
                            <p className="text-sm text-[var(--color-text-muted)]">
                              No photos in this album yet.
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
                                    className="text-sm font-semibold text-[var(--color-danger)]"
                                    disabled={
                                      pendingIntent ===
                                        "remove-photo-from-album" &&
                                      pendingAlbumId === album.id &&
                                      pendingPhotoId === photo.id
                                    }
                                    form={`remove-photo-${album.id}-${photo.id}`}
                                    type="submit"
                                  >
                                    Remove
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
                      </article>
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
