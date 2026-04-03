import type { Route } from "./+types/app-favorites";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { EmptyState, PageHeader, Panel } from "~/components/ui";
import {
  listAlbums,
  listFavorites,
  listAllPhotos,
  listSpaceAlbums,
  listSpaces,
} from "~/lib/api";
import { formatBytes, formatDateTime } from "~/lib/format";
import type { AlbumDto, FavoriteDto, PhotoDto, SpaceDto } from "~/types/api";

type FavoritesView = "all" | "photos" | "albums";

interface FavoriteAlbumCard {
  favorite: FavoriteDto;
  album: AlbumDto;
  space: SpaceDto | null;
}

interface FavoritesState {
  favoritePhotos: Array<{ favorite: FavoriteDto; photo: PhotoDto }>;
  favoriteAlbums: FavoriteAlbumCard[];
}

export async function clientLoader() {
  const [photoFavorites, albumFavorites, photos, personalAlbums] =
    await Promise.all([
      listFavorites("PHOTO"),
      listFavorites("ALBUM"),
      listAllPhotos(),
      listAlbums(),
    ]);

  const photosById = Object.fromEntries(
    photos.map((photo) => [photo.id, photo]),
  );
  const unresolvedAlbumIds = new Set(
    albumFavorites.map((favorite) => favorite.targetId),
  );
  const albumsById = Object.fromEntries(
    personalAlbums.map((album) => [album.id, album]),
  );
  for (const album of personalAlbums) {
    unresolvedAlbumIds.delete(album.id);
  }
  let spaces: SpaceDto[] = [];
  let spacesById: Record<string, SpaceDto> = {};

  if (unresolvedAlbumIds.size > 0) {
    spaces = await listSpaces();
    spacesById = Object.fromEntries(spaces.map((space) => [space.id, space]));

    const spaceAlbumLists = await Promise.all(
      spaces.map(async (space) => ({
        spaceId: space.id,
        albums: await listSpaceAlbums(space.id),
      })),
    );

    for (const { albums } of spaceAlbumLists) {
      for (const album of albums) {
        if (!unresolvedAlbumIds.has(album.id)) {
          continue;
        }

        albumsById[album.id] = album;
        unresolvedAlbumIds.delete(album.id);
      }
    }
  }

  return {
    favoritePhotos: photoFavorites
      .map((favorite) => {
        const photo = photosById[favorite.targetId];
        return photo ? { favorite, photo } : null;
      })
      .filter(
        (item): item is { favorite: FavoriteDto; photo: PhotoDto } =>
          item !== null,
      ),
    favoriteAlbums: albumFavorites
      .map((favorite) => {
        const album = albumsById[favorite.targetId];
        if (!album) {
          return null;
        }

        return {
          favorite,
          album,
          space: album.spaceId ? (spacesById[album.spaceId] ?? null) : null,
        } satisfies FavoriteAlbumCard;
      })
      .filter((item): item is FavoriteAlbumCard => item !== null),
  } satisfies FavoritesState;
}

export default function AppFavoritesRoute({
  loaderData,
}: Route.ComponentProps) {
  const [view, setView] = useState<FavoritesView>("all");
  const [filter, setFilter] = useState("");
  const data = loaderData;
  const normalizedFilter = filter.trim().toLowerCase();
  const filteredFavoritePhotos = useMemo(
    () =>
      data.favoritePhotos.filter(({ photo }) => {
        if (normalizedFilter.length === 0) {
          return true;
        }
        return photo.originalFilename.toLowerCase().includes(normalizedFilter);
      }),
    [data.favoritePhotos, normalizedFilter],
  );
  const filteredFavoriteAlbums = useMemo(
    () =>
      data.favoriteAlbums.filter(({ album, space }) => {
        if (normalizedFilter.length === 0) {
          return true;
        }
        return (
          album.name.toLowerCase().includes(normalizedFilter) ||
          (album.description ?? "").toLowerCase().includes(normalizedFilter) ||
          (space?.name ?? "").toLowerCase().includes(normalizedFilter)
        );
      }),
    [data.favoriteAlbums, normalizedFilter],
  );

  const hasAnyFavorites =
    data.favoritePhotos.length > 0 || data.favoriteAlbums.length > 0;
  const showPhotos = view === "all" || view === "photos";
  const showAlbums = view === "all" || view === "albums";
  const counts = useMemo(
    () => ({
      photos: data.favoritePhotos.length,
      albums: data.favoriteAlbums.length,
    }),
    [data.favoriteAlbums.length, data.favoritePhotos.length],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        actions={
          <>
            <Link className="button-secondary" to="/app/library">
              Open library
            </Link>
            <Link className="button-primary" to="/app/spaces">
              Explore Spaces
            </Link>
          </>
        }
        description="Collected favorites across personal photos and accessible albums, including Space albums."
        eyebrow="Favorites"
        title="Saved highlights"
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Panel className="p-5">
          <p className="eyebrow">Saved photos</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">
            {counts.photos}
          </p>
        </Panel>
        <Panel className="p-5">
          <p className="eyebrow">Saved albums</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">
            {counts.albums}
          </p>
        </Panel>
        <Panel className="p-3 sm:p-5">
          <p className="eyebrow">Filter</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { id: "all", label: "Everything" },
              { id: "photos", label: "Photos" },
              { id: "albums", label: "Albums" },
            ].map((option) => (
              <button
                aria-pressed={view === option.id}
                className={
                  view === option.id ? "button-primary" : "button-secondary"
                }
                key={option.id}
                onClick={() => {
                  setView(option.id as FavoritesView);
                }}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </Panel>
      </section>

      {hasAnyFavorites ? (
        <Panel className="p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="eyebrow">Local filter</p>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Narrow favorite items by filename, album name, or Space name.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
              <input
                aria-label="Filter favorites"
                className="field min-w-0 md:min-w-80"
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter favorites by text"
                type="search"
                value={filter}
              />
              <button
                className="button-secondary"
                disabled={normalizedFilter.length === 0}
                onClick={() => setFilter("")}
                type="button"
              >
                Clear filter
              </button>
            </div>
          </div>
        </Panel>
      ) : null}

      {!hasAnyFavorites ? (
        <EmptyState
          description="Add favorites from your library or Space flows and they will appear here."
          title="No favorites yet"
        />
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          {showPhotos ? (
            <Panel className="p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="eyebrow">Photo favorites</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                    Personal photo picks
                  </h2>
                </div>
                <span className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold">
                  {counts.photos} saved
                </span>
              </div>

              {data.favoritePhotos.length === 0 ? (
                <p className="mt-6 text-sm text-[var(--color-text-muted)]">
                  No favorite photos yet.
                </p>
              ) : filteredFavoritePhotos.length === 0 ? (
                <p className="mt-6 rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-4 text-sm text-[var(--color-text-muted)]">
                  No favorite photos match the current filter.
                </p>
              ) : (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {filteredFavoritePhotos.map(({ favorite, photo }) => (
                    <article
                      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel-strong)] p-4"
                      key={favorite.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold tracking-tight">
                            {photo.originalFilename}
                          </h3>
                          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                            {photo.mimeType} · {photo.width ?? "?"}x
                            {photo.height ?? "?"}
                          </p>
                        </div>
                        <span className="rounded-full bg-[rgba(150,93,52,0.12)] px-3 py-1 text-xs font-semibold text-[var(--color-primary-strong)]">
                          Photo
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                        {formatBytes(photo.sizeBytes)} · saved{" "}
                        {formatDateTime(favorite.createdAt)}
                      </p>
                      <Link
                        className="button-secondary mt-5 w-full"
                        to={`/app/library/photos/${photo.id}`}
                      >
                        Open photo
                      </Link>
                    </article>
                  ))}
                </div>
              )}
            </Panel>
          ) : null}

          {showAlbums ? (
            <Panel className="p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="eyebrow">Album favorites</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                    Collections worth revisiting
                  </h2>
                </div>
                <span className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold">
                  {counts.albums} saved
                </span>
              </div>

              {data.favoriteAlbums.length === 0 ? (
                <p className="mt-6 text-sm text-[var(--color-text-muted)]">
                  No favorite albums yet.
                </p>
              ) : filteredFavoriteAlbums.length === 0 ? (
                <p className="mt-6 rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-4 text-sm text-[var(--color-text-muted)]">
                  No favorite albums match the current filter.
                </p>
              ) : (
                <div className="mt-6 space-y-4">
                  {filteredFavoriteAlbums.map(({ favorite, album, space }) => (
                    <article
                      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel-strong)] p-4"
                      key={favorite.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold tracking-tight">
                            {album.name}
                          </h3>
                          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                            {space
                              ? `${space.name} Space album`
                              : "Personal album"}
                          </p>
                        </div>
                        <span className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold">
                          Album
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
                        {album.description || "No description"}
                      </p>
                      <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                        Saved {formatDateTime(favorite.createdAt)}
                      </p>
                      <Link
                        className="button-secondary mt-5 w-full"
                        to={space ? `/app/spaces/${space.id}` : "/app/library"}
                      >
                        {space ? `Open ${space.name}` : "Open library"}
                      </Link>
                    </article>
                  ))}
                </div>
              )}
            </Panel>
          ) : null}
        </section>
      )}
    </div>
  );
}
