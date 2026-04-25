import { useDeferredValue, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/app-search";
import {
  Badge,
  EmptyHint,
  EmptyState,
  InlineMessage,
  PageHeader,
  Panel,
  SurfaceCard,
} from "~/components/ui";
import {
  ApiError,
  isBackendUnavailableError,
  listFavorites,
  listPhotos,
  listSpaces,
  searchMedia,
} from "~/lib/api";
import { formatRelativeCount } from "~/lib/format";
import { useI18n } from "~/lib/i18n";
import type {
  PageResponse,
  SearchHitDto,
  SearchKind,
  SearchScope,
  SearchSort,
} from "~/types/api";

interface SearchOverviewData {
  libraryCount: number;
  spacesCount: number;
  favoriteCount: number;
}

const EMPTY_SEARCH_PAGE: PageResponse<SearchHitDto> = {
  items: [],
  page: 0,
  size: 24,
  hasNext: false,
  totalItems: 0,
  totalPages: 0,
};

const SEARCH_SCOPE_OPTIONS: SearchScope[] = [
  "all",
  "library",
  "spaces",
  "favorites",
];
const SEARCH_KIND_OPTIONS: SearchKind[] = ["all", "photo", "album"];
const SEARCH_SORT_OPTIONS: SearchSort[] = ["relevance", "newest", "oldest"];

export async function clientLoader() {
  const [photoPage, spaces, photoFavorites, albumFavorites] = await Promise.all(
    [
      listPhotos(0, 1),
      listSpaces(),
      listFavorites("PHOTO"),
      listFavorites("ALBUM"),
    ],
  );

  return {
    libraryCount: photoPage.totalItems ?? photoPage.items.length,
    spacesCount: spaces.length,
    favoriteCount: photoFavorites.length + albumFavorites.length,
  } satisfies SearchOverviewData;
}

function parseScope(value: string | null): SearchScope {
  return value && SEARCH_SCOPE_OPTIONS.includes(value as SearchScope)
    ? (value as SearchScope)
    : "all";
}

function parseKind(value: string | null): SearchKind {
  return value && SEARCH_KIND_OPTIONS.includes(value as SearchKind)
    ? (value as SearchKind)
    : "all";
}

function parseSort(value: string | null): SearchSort {
  return value && SEARCH_SORT_OPTIONS.includes(value as SearchSort)
    ? (value as SearchSort)
    : "relevance";
}

function parsePage(value: string | null) {
  if (value == null || value.length === 0) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function buildPhotoResultHref(result: SearchHitDto) {
  const photo = result.photo;
  if (
    result.entryScope === "SPACES" &&
    photo?.spaceId &&
    photo.albumId &&
    photo.photo.id
  ) {
    return `/app/spaces/${photo.spaceId}/albums/${photo.albumId}/photos/${photo.photo.id}`;
  }

  return `/app/library/photos/${photo?.photo.id ?? ""}`;
}

function buildAlbumResultHref(result: SearchHitDto) {
  const album = result.album?.album;
  if (album?.spaceId) {
    return `/app/spaces/${album.spaceId}`;
  }

  return "/app/library?view=albums";
}

function searchErrorMessage(
  error: unknown,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (error instanceof ApiError && error.code === "bad_request") {
    return t("app.search.errorBadRequest");
  }
  if (isBackendUnavailableError(error)) {
    return t("app.search.errorUnavailable");
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return t("app.search.errorGeneric");
}

export default function AppSearchRoute({ loaderData }: Route.ComponentProps) {
  const { locale, t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const scope = parseScope(searchParams.get("scope"));
  const kind = parseKind(searchParams.get("kind"));
  const sort = parseSort(searchParams.get("sort"));
  const page = parsePage(searchParams.get("page"));
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = query.trim();
  const normalizedDeferredQuery = deferredQuery.trim();
  const [searchPage, setSearchPage] =
    useState<PageResponse<SearchHitDto>>(EMPTY_SEARCH_PAGE);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const countFormatter = new Intl.NumberFormat(locale);
  const searchExamples = [
    { label: "beach", value: "beach" },
    { label: "family", value: "family" },
    { label: "sunset", value: "sunset" },
  ];
  const spaceForms = {
    one: t("unit.space.one"),
    few: t("unit.space.few"),
    many: t("unit.space.many"),
    other: t("unit.space.other"),
  };
  const photoForms = {
    one: t("unit.photo.one"),
    few: t("unit.photo.few"),
    many: t("unit.photo.many"),
    other: t("unit.photo.other"),
  };
  const resultForms = {
    one: t("unit.match.one"),
    few: t("unit.match.few"),
    many: t("unit.match.many"),
    other: t("unit.match.other"),
  };

  useEffect(() => {
    if (normalizedDeferredQuery.length === 0) {
      setStatus("idle");
      setErrorMessage(null);
      setSearchPage(EMPTY_SEARCH_PAGE);
      return;
    }

    let isCancelled = false;
    setStatus("loading");
    setErrorMessage(null);

    searchMedia({
      q: normalizedDeferredQuery,
      scope: scope === "all" ? undefined : scope,
      kind: kind === "all" ? undefined : kind,
      sort: sort === "relevance" ? undefined : sort,
      page,
      size: 24,
      needsTotal: true,
    })
      .then((page) => {
        if (isCancelled) {
          return;
        }

        const hasReachableEarlierPage =
          page.page > 0 &&
          page.items.length === 0 &&
          (page.totalItems ?? 0) > 0 &&
          (page.totalPages ?? 0) > 0 &&
          page.page >= (page.totalPages ?? 0);
        if (hasReachableEarlierPage) {
          const lastReachablePage = Math.max((page.totalPages ?? 1) - 1, 0);
          const nextParams = new URLSearchParams();
          if (normalizedDeferredQuery.length > 0) {
            nextParams.set("q", normalizedDeferredQuery);
          }
          if (scope !== "all") {
            nextParams.set("scope", scope);
          }
          if (kind !== "all") {
            nextParams.set("kind", kind);
          }
          if (sort !== "relevance") {
            nextParams.set("sort", sort);
          }
          if (lastReachablePage > 0) {
            nextParams.set("page", String(lastReachablePage));
          }
          setSearchParams(nextParams, { replace: true });
          return;
        }

        setSearchPage(page);
        setStatus("success");
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        setSearchPage(EMPTY_SEARCH_PAGE);
        setStatus("error");
        setErrorMessage(searchErrorMessage(error, t));
      });

    return () => {
      isCancelled = true;
    };
  }, [kind, normalizedDeferredQuery, page, scope, setSearchParams, sort, t]);

  function updateParams(
    updates: Record<string, string | null>,
    options: { resetPage?: boolean } = {},
  ) {
    const nextParams = new URLSearchParams(searchParams);

    if (options.resetPage) {
      nextParams.delete("page");
    }

    for (const [name, value] of Object.entries(updates)) {
      if (value == null || value.length === 0) {
        nextParams.delete(name);
      } else {
        nextParams.set(name, value);
      }
    }

    setSearchParams(nextParams, { replace: true });
  }

  const visibleResultCount = searchPage.totalItems ?? searchPage.items.length;
  const visibleRangeStart =
    searchPage.items.length > 0 ? searchPage.page * searchPage.size + 1 : 0;
  const visibleRangeEnd =
    searchPage.page * searchPage.size + searchPage.items.length;
  const hasMultiplePages =
    searchPage.page > 0 ||
    searchPage.hasNext ||
    (searchPage.totalPages != null && searchPage.totalPages > 1);
  const totalPages =
    searchPage.totalPages ?? searchPage.page + (searchPage.hasNext ? 2 : 1);

  function goToPage(nextPage: number) {
    const safePage = Math.max(nextPage, 0);
    updateParams({ page: safePage <= 0 ? null : String(safePage) });
  }

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
                updateParams(
                  {
                    q:
                      event.target.value.trim().length === 0
                        ? null
                        : event.target.value,
                  },
                  { resetPage: true },
                );
              }}
              placeholder={t("app.search.queryPlaceholder")}
              type="search"
              value={query}
            />
            <button
              className="button-secondary"
              disabled={normalizedQuery.length === 0}
              onClick={() => {
                updateParams({ q: null }, { resetPage: true });
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
                updateParams({ q: example.value }, { resetPage: true });
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

                updateParams(
                  { scope: filter.id === "all" ? null : filter.id },
                  { resetPage: true },
                );
              }}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {SEARCH_KIND_OPTIONS.map((option) => (
              <button
                aria-pressed={kind === option}
                className={
                  kind === option ? "button-primary" : "button-secondary"
                }
                key={option}
                onClick={() => {
                  updateParams(
                    { kind: option === "all" ? null : option },
                    { resetPage: true },
                  );
                }}
                type="button"
              >
                {t(`app.search.kind.${option}` as const)}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-3">
            <span className="text-sm font-medium">
              {t("app.search.sortLabel")}
            </span>
            <select
              aria-label={t("app.search.sortLabel")}
              className="field min-w-44"
              onChange={(event) => {
                updateParams(
                  {
                    sort:
                      event.target.value === "relevance"
                        ? null
                        : event.target.value,
                  },
                  { resetPage: true },
                );
              }}
              value={sort}
            >
              {SEARCH_SORT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(`app.search.sort.${option}` as const)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <Panel className="p-4">
            <p className="eyebrow">{t("app.search.currentLibrary")}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {formatRelativeCount(loaderData.libraryCount, photoForms)}
            </p>
          </Panel>
          <Panel className="p-4">
            <p className="eyebrow">{t("app.search.accessibleSpaces")}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {formatRelativeCount(loaderData.spacesCount, spaceForms)}
            </p>
          </Panel>
          <Panel className="p-4">
            <p className="eyebrow">{t("app.search.favorites")}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {formatRelativeCount(loaderData.favoriteCount, {
                one: t("unit.savedItem.one"),
                few: t("unit.savedItem.few"),
                many: t("unit.savedItem.many"),
                other: t("unit.savedItem.other"),
              })}
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
          <p className="eyebrow">{t("app.search.resultsTitle")}</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("app.search.resultsDescription")}
            </p>
            {normalizedQuery.length > 0 && status === "success" ? (
              <Badge tone="accent">
                {formatRelativeCount(visibleResultCount, resultForms)}
              </Badge>
            ) : null}
          </div>
          {normalizedQuery.length > 0 &&
          status === "success" &&
          visibleResultCount > searchPage.items.length ? (
            <p className="mt-4 text-sm text-[var(--color-text-muted)]">
              {t("app.search.partialResults", {
                start: countFormatter.format(visibleRangeStart),
                end: countFormatter.format(visibleRangeEnd),
                total: countFormatter.format(visibleResultCount),
              })}
            </p>
          ) : null}
        </Panel>
      </section>

      {normalizedQuery.length === 0 ? (
        <EmptyState
          action={
            <Link className="button-secondary" to="/app/library?view=photos">
              {t("app.search.openTimelineInstead")}
            </Link>
          }
          description={t("app.search.emptyDescription")}
          title={t("app.search.emptyTitle")}
        />
      ) : null}

      {normalizedQuery.length > 0 && status === "loading" ? (
        <Panel className="p-6">
          <InlineMessage tone="success">
            {t("app.search.loadingDescription")}
          </InlineMessage>
        </Panel>
      ) : null}

      {normalizedQuery.length > 0 && status === "error" ? (
        <Panel className="p-6">
          <InlineMessage tone="danger">
            {errorMessage ?? t("app.search.errorGeneric")}
          </InlineMessage>
        </Panel>
      ) : null}

      {normalizedQuery.length > 0 &&
      status === "success" &&
      searchPage.items.length === 0 ? (
        <EmptyHint className="px-5 py-6 leading-7">
          {t("app.search.noResultsDescription", { query: normalizedQuery })}
        </EmptyHint>
      ) : null}

      {normalizedQuery.length > 0 &&
      status === "success" &&
      searchPage.items.length > 0 ? (
        <section className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-2">
            {searchPage.items.map((result) => {
              if (result.kind === "PHOTO" && result.photo) {
                const photo = result.photo.photo;
                const contextDescription =
                  result.entryScope === "SPACES" &&
                  result.photo.spaceName &&
                  result.photo.albumName
                    ? t("app.search.spacePhotoContext", {
                        spaceName: result.photo.spaceName,
                        albumName: result.photo.albumName,
                      })
                    : t("app.search.personalPhotoContext");

                return (
                  <SurfaceCard
                    className="rounded-2xl p-0"
                    key={`photo-${photo.id}`}
                  >
                    <Link
                      className="block p-5"
                      to={buildPhotoResultHref(result)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {photo.originalFilename}
                          </p>
                          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                            {contextDescription}
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Badge>{t("app.favorites.photoBadge")}</Badge>
                          {result.favorited ? (
                            <Badge tone="accent">
                              {t("app.photoDetail.badgeSaved")}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-4 text-sm text-[var(--color-text-muted)]">
                        {photo.mimeType} · {photo.width ?? "?"}x
                        {photo.height ?? "?"}
                      </p>
                    </Link>
                  </SurfaceCard>
                );
              }

              if (result.kind === "ALBUM" && result.album) {
                const album = result.album.album;
                const contextDescription =
                  album.spaceId && result.album.spaceName
                    ? t("app.favorites.collaborativeAlbum", {
                        spaceName: result.album.spaceName,
                      })
                    : t("app.favorites.personalAlbum");

                return (
                  <SurfaceCard
                    className="rounded-2xl p-0"
                    key={`album-${album.id}`}
                  >
                    <Link
                      className="block p-5"
                      to={buildAlbumResultHref(result)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{album.name}</p>
                          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                            {contextDescription}
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Badge>{t("app.favorites.albumBadge")}</Badge>
                          {result.favorited ? (
                            <Badge tone="accent">
                              {t("app.photoDetail.badgeSaved")}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-4 text-sm text-[var(--color-text-muted)]">
                        {album.description?.trim() ||
                          t("app.favorites.noDescription")}
                      </p>
                    </Link>
                  </SurfaceCard>
                );
              }

              return null;
            })}
          </div>

          {hasMultiplePages ? (
            <Panel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                className="button-secondary"
                disabled={searchPage.page <= 0}
                onClick={() => {
                  goToPage(searchPage.page - 1);
                }}
                type="button"
              >
                {t("app.search.previousPage")}
              </button>
              <p
                aria-live="polite"
                className="text-sm text-[var(--color-text-muted)]"
              >
                {t("app.search.pageIndicator", {
                  page: countFormatter.format(searchPage.page + 1),
                  totalPages: countFormatter.format(totalPages),
                })}
              </p>
              <button
                className="button-secondary"
                disabled={!searchPage.hasNext}
                onClick={() => {
                  goToPage(searchPage.page + 1);
                }}
                type="button"
              >
                {t("app.search.nextPage")}
              </button>
            </Panel>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
