import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/app-search";
import {
  EmptyHint,
  EmptyState,
  PageHeader,
  Panel,
  SurfaceCard,
} from "~/components/ui";
import { listFavorites, listPhotos, listSpaces } from "~/lib/api";
import { formatRelativeCount } from "~/lib/format";
import type { PhotoDto, SpaceDto } from "~/types/api";

type SearchScope = "all" | "library" | "spaces" | "favorites";

interface SearchShellData {
  photos: PhotoDto[];
  spaces: SpaceDto[];
  favoritePhotoCount: number;
  favoriteAlbumCount: number;
}

export async function clientLoader() {
  const [photoPage, spaces, photoFavorites, albumFavorites] = await Promise.all(
    [
      listPhotos(0, 8),
      listSpaces(),
      listFavorites("PHOTO"),
      listFavorites("ALBUM"),
    ],
  );

  return {
    photos: photoPage.items,
    spaces,
    favoritePhotoCount: photoFavorites.length,
    favoriteAlbumCount: albumFavorites.length,
  } satisfies SearchShellData;
}

export default function AppSearchRoute({ loaderData }: Route.ComponentProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const scope = (searchParams.get("scope") as SearchScope | null) ?? "all";
  const normalizedQuery = query.trim().toLowerCase();
  const searchExamples = [
    { label: "beach", value: "beach" },
    { label: "family", value: "family" },
    { label: "sunset", value: "sunset" },
  ];

  const matchingPhotos =
    normalizedQuery.length === 0
      ? []
      : loaderData.photos.filter((photo) =>
          photo.originalFilename.toLowerCase().includes(normalizedQuery),
        );
  const matchingSpaces =
    normalizedQuery.length === 0
      ? []
      : loaderData.spaces.filter((space) =>
          space.name.toLowerCase().includes(normalizedQuery),
        );

  const activePreviewItems =
    scope === "spaces"
      ? matchingSpaces.length
      : scope === "library" || scope === "favorites"
        ? matchingPhotos.length
        : matchingPhotos.length + matchingSpaces.length;
  const previewScopeLabel =
    scope === "library"
      ? "library"
      : scope === "spaces"
        ? "Spaces"
        : scope === "favorites"
          ? "favorites"
          : "all visible content";

  return (
    <div className="space-y-8">
      <PageHeader
        actions={
          <>
            <Link className="button-secondary" to="/app/library">
              Back to library
            </Link>
            <Link className="button-primary" to="/app/favorites">
              Browse favorites
            </Link>
          </>
        }
        description="The frontend route and search interaction shell are ready. Actual semantic search, face search, and tag search will be connected once the ML and indexing backend arrives."
        eyebrow="Search"
        title="Discovery"
      />

      <Panel className="p-6">
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Search query</span>
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              aria-label="Search query"
              className="field flex-1"
              onChange={(event) => {
                const nextParams = new URLSearchParams(searchParams);
                if (event.target.value.trim().length === 0) {
                  nextParams.delete("q");
                } else {
                  nextParams.set("q", event.target.value);
                }
                setSearchParams(nextParams, { replace: true });
              }}
              placeholder="Search by text, person, place, or tag"
              type="search"
              value={query}
            />
            <button
              className="button-secondary"
              disabled={normalizedQuery.length === 0}
              onClick={() => {
                const nextParams = new URLSearchParams(searchParams);
                nextParams.delete("q");
                setSearchParams(nextParams, { replace: true });
              }}
              type="button"
            >
              Clear query
            </button>
          </div>
        </label>

        <div className="mt-4 flex flex-wrap gap-3">
          {searchExamples.map((example) => (
            <button
              className="button-secondary"
              key={example.value}
              onClick={() => {
                const nextParams = new URLSearchParams(searchParams);
                nextParams.set("q", example.value);
                setSearchParams(nextParams, { replace: true });
              }}
              type="button"
            >
              Try {example.label}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {[
            { id: "all", label: "All scopes" },
            { id: "library", label: "Library" },
            { id: "spaces", label: "Spaces" },
            { id: "favorites", label: "Favorites" },
            { id: "faces", label: "Faces (Later)" },
            { id: "tags", label: "Tags (Later)" },
          ].map((filter) => (
            <button
              aria-disabled={filter.id === "faces" || filter.id === "tags"}
              aria-pressed={scope === filter.id}
              className={
                filter.id === "faces" || filter.id === "tags"
                  ? "button-secondary cursor-not-allowed opacity-70"
                  : scope === filter.id
                    ? "button-primary"
                    : "button-secondary"
              }
              key={filter.id}
              onClick={() => {
                if (filter.id === "faces" || filter.id === "tags") {
                  return;
                }
                const nextParams = new URLSearchParams(searchParams);
                if (filter.id === "all") {
                  nextParams.delete("scope");
                } else {
                  nextParams.set("scope", filter.id);
                }
                setSearchParams(nextParams, { replace: true });
              }}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <Panel className="p-4">
            <p className="eyebrow">Current library</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {formatRelativeCount(
                loaderData.photos.length,
                "preview photo",
                "preview photos",
              )}
            </p>
          </Panel>
          <Panel className="p-4">
            <p className="eyebrow">Accessible Spaces</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {formatRelativeCount(loaderData.spaces.length, "Space", "Spaces")}
            </p>
          </Panel>
          <Panel className="p-4">
            <p className="eyebrow">Favorites</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {loaderData.favoritePhotoCount + loaderData.favoriteAlbumCount}{" "}
              saved items
            </p>
          </Panel>
        </div>
      </Panel>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr_1fr]">
        <Panel className="p-6">
          <p className="eyebrow">Planned query types</p>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--color-text-muted)]">
            <li>Free-text search across ML-generated captions and tags</li>
            <li>Face/person search after clustering and identity linking</li>
            <li>
              Scoped search inside personal library, favorites, or a specific
              Space
            </li>
          </ul>
        </Panel>

        <Panel className="p-6">
          <p className="eyebrow">Backend requirements</p>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--color-text-muted)]">
            <li>Indexed text and tag search endpoints</li>
            <li>Face and embedding-aware retrieval</li>
            <li>Paginated result ranking with access-control filtering</li>
          </ul>
        </Panel>

        <Panel className="p-6">
          <p className="eyebrow">Local preview</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-[var(--color-text-muted)]">
              Preview scope:{" "}
              <span className="font-semibold text-[var(--color-text)]">
                {previewScopeLabel}
              </span>
            </p>
            {normalizedQuery.length > 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                {activePreviewItems} lightweight matches
              </p>
            ) : null}
          </div>
          {normalizedQuery.length === 0 ? (
            <EmptyState
              action={
                <Link
                  className="button-secondary"
                  to="/app/library?view=timeline"
                >
                  Open timeline instead
                </Link>
              }
              description="Type a query to see a lightweight client-side preview based on filenames and Space names. This is not the final search implementation."
              title="Search backend not connected yet"
            />
          ) : activePreviewItems === 0 ? (
            <EmptyHint className="mt-4 px-5 py-6 leading-7">
              No client-side preview matches were found for{" "}
              <span className="font-semibold text-[var(--color-text)]">
                {query}
              </span>
              . Full search results will require backend indexing.
            </EmptyHint>
          ) : (
            <div className="mt-4 space-y-3">
              {scope !== "spaces" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="eyebrow">Photo preview</p>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {matchingPhotos.length} matches
                    </p>
                  </div>
                  {matchingPhotos.length === 0 ? (
                    <EmptyHint>
                      No matching photos in the current local preview sample.
                    </EmptyHint>
                  ) : (
                    matchingPhotos.map((photo) => (
                      <SurfaceCard
                        className="rounded-2xl p-0 hover:bg-white"
                        key={photo.id}
                      >
                        <Link
                          className="block p-4"
                          to={`/app/library/photos/${photo.id}`}
                        >
                          <p className="text-sm font-semibold">
                            {photo.originalFilename}
                          </p>
                          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                            Photo metadata preview
                          </p>
                        </Link>
                      </SurfaceCard>
                    ))
                  )}
                </div>
              ) : null}
              {scope !== "library" && scope !== "favorites" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="eyebrow">Space preview</p>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {matchingSpaces.length} matches
                    </p>
                  </div>
                  {matchingSpaces.length === 0 ? (
                    <EmptyHint>
                      No matching Spaces in the current local preview sample.
                    </EmptyHint>
                  ) : (
                    matchingSpaces.map((space) => (
                      <SurfaceCard
                        className="rounded-2xl p-0 hover:bg-white"
                        key={space.id}
                      >
                        <Link
                          className="block p-4"
                          to={`/app/spaces/${space.id}`}
                        >
                          <p className="text-sm font-semibold">{space.name}</p>
                          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                            Space name preview
                          </p>
                        </Link>
                      </SurfaceCard>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}
