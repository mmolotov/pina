import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/public-album";
import { LanguageSwitcher } from "~/components/language-switcher";
import { InlineMessage } from "~/components/ui";
import {
  ApiError,
  buildPublicAlbumPhotoFileUrl,
  fetchPublicAlbumByToken,
} from "~/lib/api";
import { formatDateRange } from "~/lib/format";
import { useI18n } from "~/lib/i18n";
import type { PublicAlbumResponseDto, PublicPhotoDto } from "~/types/api";

const PHOTOS_PAGE_SIZE = 60;

type LoaderResult =
  | { ok: true; data: PublicAlbumResponseDto }
  | { ok: false; status: number };

export async function clientLoader({
  params,
}: Route.ClientLoaderArgs): Promise<LoaderResult> {
  const token = params.token ?? "";
  try {
    const data = await fetchPublicAlbumByToken(token, {
      page: 0,
      size: PHOTOS_PAGE_SIZE,
      needsTotal: true,
    });
    return { ok: true, data };
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 0;
    return { ok: false, status };
  }
}

export function meta() {
  return [{ title: "Shared album" }];
}

export default function PublicAlbumRoute({
  loaderData,
  params,
}: Route.ComponentProps) {
  const { t } = useI18n();
  const token = params.token ?? "";

  if (!loaderData.ok) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center px-6 py-10">
        <section className="panel w-full max-w-2xl p-8 sm:p-10">
          <div className="flex items-start justify-between gap-4">
            <p className="eyebrow">{t("public.album.eyebrow")}</p>
            <LanguageSwitcher />
          </div>
          <InlineMessage className="mt-6" tone="danger">
            {t("public.album.notFound")}
          </InlineMessage>
          <div className="mt-5">
            <Link className="button-secondary" to="/">
              {t("public.album.backHome")}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return <PublicAlbumView initial={loaderData.data} token={token} />;
}

function PublicAlbumView(props: {
  initial: PublicAlbumResponseDto;
  token: string;
}) {
  const { t } = useI18n();
  const [photos, setPhotos] = useState<PublicPhotoDto[]>(
    props.initial.photos.items,
  );
  const [hasNext, setHasNext] = useState(props.initial.photos.hasNext);
  const [nextPage, setNextPage] = useState(props.initial.photos.page + 1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastTokenRef = useRef(props.token);

  useEffect(() => {
    if (lastTokenRef.current !== props.token) {
      lastTokenRef.current = props.token;
      setPhotos(props.initial.photos.items);
      setHasNext(props.initial.photos.hasNext);
      setNextPage(props.initial.photos.page + 1);
      setLoadError(null);
    }
  }, [props.initial, props.token]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasNext) {
      return;
    }
    setIsLoadingMore(true);
    setLoadError(null);
    try {
      const next = await fetchPublicAlbumByToken(props.token, {
        page: nextPage,
        size: PHOTOS_PAGE_SIZE,
      });
      setPhotos((prev) => [...prev, ...next.photos.items]);
      setHasNext(next.photos.hasNext);
      setNextPage(next.photos.page + 1);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : t("public.album.notFound");
      setLoadError(message);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasNext, isLoadingMore, nextPage, props.token, t]);

  const album = props.initial.album;
  const totalCount = props.initial.photos.totalItems ?? photos.length;
  const countLabel =
    totalCount === 0
      ? t("public.album.photoCountZero")
      : totalCount === 1
        ? t("public.album.photoCountOne")
        : t("public.album.photoCount", { count: totalCount });

  return (
    <main className="app-shell min-h-screen px-6 py-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="panel p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <p className="eyebrow">{t("public.album.eyebrow")}</p>
            <LanguageSwitcher />
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {album.name}
          </h1>
          <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
            {album.description || t("public.album.emptyDescription")}
          </p>
          <dl className="mt-4 grid gap-3 text-sm text-[var(--color-text-muted)] sm:grid-cols-2">
            <div>
              <dt className="eyebrow">{countLabel}</dt>
              <dd className="mt-1">
                {formatDateRange(
                  album.mediaRangeStart,
                  album.mediaRangeEnd,
                )}
              </dd>
            </div>
          </dl>
        </header>

        {photos.length === 0 ? (
          <p className="panel p-6 text-sm text-[var(--color-text-muted)]">
            {t("public.album.photoCountZero")}
          </p>
        ) : (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {photos.map((photo) => (
              <PublicAlbumThumb
                key={photo.id}
                photo={photo}
                token={props.token}
              />
            ))}
          </section>
        )}

        {loadError ? (
          <InlineMessage tone="danger">{loadError}</InlineMessage>
        ) : null}

        {hasNext ? (
          <div className="flex justify-center">
            <button
              className="button-secondary"
              disabled={isLoadingMore}
              onClick={loadMore}
              type="button"
            >
              {isLoadingMore
                ? t("public.album.loadingMore")
                : t("public.album.loadMore")}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function PublicAlbumThumb(props: {
  photo: PublicPhotoDto;
  token: string;
}) {
  const { t } = useI18n();
  const thumbUrl = buildPublicAlbumPhotoFileUrl(
    props.token,
    props.photo.id,
    "THUMB_MD",
  );
  const originalUrl = buildPublicAlbumPhotoFileUrl(
    props.token,
    props.photo.id,
    "ORIGINAL",
  );
  return (
    <a
      className="group relative block aspect-square overflow-hidden rounded-xl bg-[var(--color-surface)]"
      href={originalUrl}
      rel="noopener noreferrer"
      target="_blank"
      title={t("public.album.openOriginal")}
    >
      <img
        alt={props.photo.originalFilename}
        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
        loading="lazy"
        src={thumbUrl}
      />
    </a>
  );
}
