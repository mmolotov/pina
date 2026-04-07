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
import { useI18n } from "~/lib/i18n";
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
  const { locale, t } = useI18n();
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
      ? t("app.search.previewScopeLibrary")
      : scope === "spaces"
        ? t("app.search.previewScopeSpaces")
        : scope === "favorites"
          ? t("app.search.previewScopeFavorites")
          : t("app.search.previewScopeAll");
  const countFormatter = new Intl.NumberFormat(locale);
  const spaceForms = {
    one: t("unit.space.one"),
    few: t("unit.space.few"),
    many: t("unit.space.many"),
    other: t("unit.space.other"),
  };
  const matchForms = {
    one: t("unit.match.one"),
    few: t("unit.match.few"),
    many: t("unit.match.many"),
    other: t("unit.match.other"),
  };
  const photoForms = {
    one: t("unit.photo.one"),
    few: t("unit.photo.few"),
    many: t("unit.photo.many"),
    other: t("unit.photo.other"),
  };

  return (
    <div className="space-y-8">
      <PageHeader
        actions={
          <>
            <Link className="button-secondary" to="/app/library">
              {t("app.search.backToLibrary")}
            </Link>
            <Link className="button-primary" to="/app/favorites">
              {t("app.search.browseFavorites")}
            </Link>
          </>
        }
        description={t("app.search.description")}
        eyebrow={t("app.search.eyebrow")}
        title={t("app.search.title")}
      />

      <Panel className="p-6">
        <label className="block">
          <span className="mb-2 block text-sm font-medium">
            {t("app.search.queryLabel")}
          </span>
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              aria-label={t("app.search.queryLabel")}
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
              placeholder={t("app.search.queryPlaceholder")}
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
              {t("common.clear")}
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
              {t("app.search.tryExample", { label: example.label })}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {[
            { id: "all", label: t("app.search.scope.all") },
            { id: "library", label: t("app.search.scope.library") },
            { id: "spaces", label: t("app.search.scope.spaces") },
            { id: "favorites", label: t("app.search.scope.favorites") },
            { id: "faces", label: t("app.search.scope.facesLater") },
            { id: "tags", label: t("app.search.scope.tagsLater") },
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
            <p className="eyebrow">{t("app.search.currentLibrary")}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {formatRelativeCount(loaderData.photos.length, photoForms)}
            </p>
          </Panel>
          <Panel className="p-4">
            <p className="eyebrow">{t("app.search.accessibleSpaces")}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {formatRelativeCount(loaderData.spaces.length, spaceForms)}
            </p>
          </Panel>
          <Panel className="p-4">
            <p className="eyebrow">{t("app.search.favorites")}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {formatRelativeCount(
                loaderData.favoritePhotoCount + loaderData.favoriteAlbumCount,
                {
                  one: t("unit.savedItem.one"),
                  few: t("unit.savedItem.few"),
                  many: t("unit.savedItem.many"),
                  other: t("unit.savedItem.other"),
                },
              )}
            </p>
          </Panel>
        </div>
      </Panel>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr_1fr]">
        <Panel className="p-6">
          <p className="eyebrow">{t("app.search.plannedQueryTypes")}</p>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--color-text-muted)]">
            <li>{t("app.search.queryType.freeText")}</li>
            <li>{t("app.search.queryType.faces")}</li>
            <li>{t("app.search.queryType.scoped")}</li>
          </ul>
        </Panel>

        <Panel className="p-6">
          <p className="eyebrow">{t("app.search.backendRequirements")}</p>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--color-text-muted)]">
            <li>{t("app.search.backendRequirement.indexed")}</li>
            <li>{t("app.search.backendRequirement.embedding")}</li>
            <li>{t("app.search.backendRequirement.ranking")}</li>
          </ul>
        </Panel>

        <Panel className="p-6">
          <p className="eyebrow">{t("app.search.localPreview")}</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("app.search.previewScope")}:{" "}
              <span className="font-semibold text-[var(--color-text)]">
                {previewScopeLabel}
              </span>
            </p>
            {normalizedQuery.length > 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                {t("app.search.lightweightMatches", {
                  count: countFormatter.format(activePreviewItems),
                })}
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
                  {t("app.search.openTimelineInstead")}
                </Link>
              }
              description={t("app.search.emptyDescription")}
              title={t("app.search.emptyTitle")}
            />
          ) : activePreviewItems === 0 ? (
            <EmptyHint className="mt-4 px-5 py-6 leading-7">
              {t("app.search.noMatches", { query })}
            </EmptyHint>
          ) : (
            <div className="mt-4 space-y-3">
              {scope !== "spaces" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="eyebrow">{t("app.search.photoPreview")}</p>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {formatRelativeCount(matchingPhotos.length, matchForms)}
                    </p>
                  </div>
                  {matchingPhotos.length === 0 ? (
                    <EmptyHint>{t("app.search.noPhotoMatches")}</EmptyHint>
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
                            {t("app.search.photoMetadataPreview")}
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
                    <p className="eyebrow">{t("app.search.spacePreview")}</p>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {formatRelativeCount(matchingSpaces.length, matchForms)}
                    </p>
                  </div>
                  {matchingSpaces.length === 0 ? (
                    <EmptyHint>{t("app.search.noSpaceMatches")}</EmptyHint>
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
                            {t("app.search.spaceNamePreview")}
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
