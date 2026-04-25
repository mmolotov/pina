import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  Download,
  Edit3,
  MoreHorizontal,
  Share2,
  Star,
  Trash2,
} from "lucide-react";
import { getPhotoBlob, listAlbumPhotos } from "~/lib/api";
import { formatDateRange, formatRelativeCount } from "~/lib/format";
import { useI18n, type Locale } from "~/lib/i18n";
import {
  selectAlbumListThumbPreviewVariant,
  selectAlbumTilePreviewVariant,
  selectPhotoPreviewVariant,
  type PhotoPreviewVariant,
} from "~/lib/photo-preview";
import {
  albumPhotoSwatchClass,
  getAlbumPaletteIndex,
  type AlbumTileStyle,
} from "~/lib/album-view-prefs";
import type { AlbumDto } from "~/types/api";

type RelativeForms = {
  one: string;
  few: string;
  many: string;
  other: string;
};

interface CommonTileProps {
  album: AlbumDto;
  locale: Locale;
  photoForms: RelativeForms;
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
}

interface AlbumTileProps extends CommonTileProps {
  style: AlbumTileStyle;
}

function buildAlbumDetailPath(albumId: string): string {
  return `/app/library/albums/${albumId}`;
}

function useAlbumCoverUrl(
  album: AlbumDto,
  variantSelector: (variants: AlbumDto["coverVariants"]) => PhotoPreviewVariant,
): string | null {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const previewVariant = variantSelector(album.coverVariants);

  useEffect(() => {
    if (!album.coverPhotoId) {
      setCoverUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    getPhotoBlob(album.coverPhotoId, previewVariant)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setCoverUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setCoverUrl(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [album.coverPhotoId, previewVariant]);

  return coverUrl;
}

const COMPACT_PREVIEW_COUNT = 4;
const COMPACT_PREVIEW_TARGET_WIDTH = 96;

function useAlbumPreviewThumbs(
  album: AlbumDto,
  count = COMPACT_PREVIEW_COUNT,
): string[] {
  const [thumbs, setThumbs] = useState<string[]>([]);

  useEffect(() => {
    if (album.photoCount <= 0) {
      setThumbs([]);
      return;
    }

    let cancelled = false;
    const objectUrls: string[] = [];

    (async () => {
      try {
        const page = await listAlbumPhotos(album.id, 0, count);
        if (cancelled) return;

        const blobs = await Promise.all(
          page.items.map(async (photo) => {
            const variant = selectPhotoPreviewVariant(
              photo.variants,
              COMPACT_PREVIEW_TARGET_WIDTH,
            );
            try {
              return await getPhotoBlob(photo.id, variant);
            } catch {
              return null;
            }
          }),
        );

        if (cancelled) return;

        const resolved: string[] = [];
        for (const blob of blobs) {
          if (!blob) continue;
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          resolved.push(url);
        }
        setThumbs(resolved);
      } catch {
        if (!cancelled) setThumbs([]);
      }
    })();

    return () => {
      cancelled = true;
      for (const url of objectUrls) URL.revokeObjectURL(url);
    };
  }, [album.id, album.photoCount, count]);

  return thumbs;
}

function useCtxMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  return { open, setOpen, ref };
}

function ContextMenu(props: {
  album: AlbumDto;
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
  buttonClassName: string;
}) {
  const { t } = useI18n();
  const { open, setOpen, ref } = useCtxMenu();

  return (
    <div className="atc-menu-wrap" ref={ref}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("app.library.albumMenuButtonAria", {
          albumName: props.album.name,
        })}
        className={props.buttonClassName}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        type="button"
      >
        <MoreHorizontal size={15} />
      </button>
      {open ? (
        <div
          aria-label={t("app.library.albumMenuAria", {
            albumName: props.album.name,
          })}
          className="album-ctx-menu"
          role="menu"
        >
          <button
            className="album-ctx-item"
            disabled={props.isFavoriteBusy}
            onClick={() => {
              setOpen(false);
              props.onFavoriteToggle();
            }}
            role="menuitem"
            type="button"
          >
            {props.isFavoriteBusy
              ? t("common.updating")
              : props.isFavorite
                ? t("common.unfavorite")
                : t("common.favorite")}
          </button>
          <button
            className="album-ctx-item"
            onClick={() => {
              setOpen(false);
              props.onEdit();
            }}
            role="menuitem"
            type="button"
          >
            {t("app.library.editAlbumMenu")}
          </button>
          <button
            className="album-ctx-item"
            disabled={props.isShareBusy}
            onClick={() => {
              setOpen(false);
              props.onShare();
            }}
            role="menuitem"
            type="button"
          >
            {props.isShareBusy
              ? t("common.updating")
              : t("app.library.shareAlbumMenu")}
          </button>
          <button
            className="album-ctx-item"
            disabled={props.isDownloadBusy}
            onClick={() => {
              setOpen(false);
              props.onDownload();
            }}
            role="menuitem"
            type="button"
          >
            {props.isDownloadBusy
              ? t("common.loading")
              : t("app.library.downloadAlbumMenu")}
          </button>
          <button
            className="album-ctx-item danger"
            disabled={props.isDeleteBusy}
            onClick={() => {
              setOpen(false);
              props.onDelete();
            }}
            role="menuitem"
            type="button"
          >
            {props.isDeleteBusy ? t("common.deleting") : t("common.delete")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CardTile(props: CommonTileProps) {
  const { t } = useI18n();
  const coverUrl = useAlbumCoverUrl(props.album, selectAlbumTilePreviewVariant);
  const paletteIdx = getAlbumPaletteIndex(props.album.id);
  const hasPhotos = props.album.photoCount > 0;
  const dateRangeLabel = hasPhotos
    ? formatDateRange(
        props.album.mediaRangeStart,
        props.album.mediaRangeEnd,
        props.locale,
      )
    : t("app.library.albumDateRangeEmpty");

  return (
    <article className="atc">
      <ContextMenu
        album={props.album}
        buttonClassName="atc-dots-btn"
        isDeleteBusy={props.isDeleteBusy}
        isDownloadBusy={props.isDownloadBusy}
        isFavorite={props.isFavorite}
        isFavoriteBusy={props.isFavoriteBusy}
        isShareBusy={props.isShareBusy}
        onDelete={props.onDelete}
        onDownload={props.onDownload}
        onEdit={props.onEdit}
        onFavoriteToggle={props.onFavoriteToggle}
        onShare={props.onShare}
      />
      <Link
        aria-label={t("app.library.openAlbumAria", {
          albumName: props.album.name,
        })}
        className="block"
        to={buildAlbumDetailPath(props.album.id)}
      >
        <div className={`atc-cover album-palette-${paletteIdx}`}>
          {coverUrl ? (
            <img
              alt={t("app.library.albumCoverAlt", {
                albumName: props.album.name,
              })}
              className="atc-cover-image"
              src={coverUrl}
            />
          ) : (
            <div className="atc-placeholder-label">
              <span className="eyebrow">
                {t("app.library.albumPlaceholderEyebrow")}
              </span>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {t("app.library.albumPlaceholderDescription")}
              </p>
            </div>
          )}
          <div className="atc-badges">
            {props.isFavorite ? (
              <span className="atc-fav-badge" aria-hidden>
                <Star size={11} fill="currentColor" strokeWidth={1.5} />
              </span>
            ) : null}
            <span className="atc-count-badge">{props.album.photoCount}</span>
          </div>
        </div>
        <div className="atc-body">
          <h3 className="atc-name" title={props.album.name}>
            {props.album.name}
          </h3>
          <p className="atc-desc">
            {props.album.description ? (
              props.album.description
            ) : (
              <span className="nil">
                {t("app.library.albumDescriptionFallback")}
              </span>
            )}
          </p>
          <dl className="atc-meta">
            <div>
              <dt className="eyebrow">
                {t("app.library.albumDateRangeLabel")}
              </dt>
              <dd>{dateRangeLabel}</dd>
            </div>
            <div>
              <dt className="eyebrow">{t("app.library.albumItemsLabel")}</dt>
              <dd>
                {formatRelativeCount(props.album.photoCount, props.photoForms)}
              </dd>
            </div>
          </dl>
        </div>
      </Link>
    </article>
  );
}

function CompactTile(props: CommonTileProps) {
  const { t } = useI18n();
  const coverUrl = useAlbumCoverUrl(props.album, selectAlbumTilePreviewVariant);
  const previewThumbs = useAlbumPreviewThumbs(props.album);
  const paletteIdx = getAlbumPaletteIndex(props.album.id);

  return (
    <article className="atco">
      <Link
        aria-label={t("app.library.openAlbumAria", {
          albumName: props.album.name,
        })}
        className="block"
        to={buildAlbumDetailPath(props.album.id)}
      >
        <div className={`atco-cover album-palette-${paletteIdx}`}>
          {coverUrl ? (
            <img
              alt={t("app.library.albumCoverAlt", {
                albumName: props.album.name,
              })}
              className="atco-cover-image"
              src={coverUrl}
            />
          ) : null}
          <div className="atco-grad" />
          {props.isFavorite ? (
            <span className="atco-fav" aria-hidden>
              <Star size={11} fill="currentColor" strokeWidth={1.5} />
            </span>
          ) : null}
          <span
            className="atco-pill"
            style={{ left: props.isFavorite ? "2.375rem" : "0.625rem" }}
          >
            {props.album.photoCount}
          </span>
          <div className="atco-bottom">
            <div className="min-w-0">
              <p className="atco-name" title={props.album.name}>
                {props.album.name}
              </p>
              <p className="atco-count">
                {formatRelativeCount(props.album.photoCount, props.photoForms)}
              </p>
            </div>
            <div className="atco-mosaic" aria-hidden>
              {previewThumbs.length > 0
                ? previewThumbs.slice(0, 4).map((url, index) => (
                    <div
                      className="atco-mosaic-thumb"
                      key={url}
                      style={{ backgroundImage: `url(${url})` }}
                    >
                      <span className="sr-only" aria-hidden>
                        {index}
                      </span>
                    </div>
                  ))
                : Array.from({ length: 4 }, (_, index) => (
                    <div className={albumPhotoSwatchClass(index)} key={index} />
                  ))}
            </div>
          </div>
        </div>
      </Link>
      <ContextMenu
        album={props.album}
        buttonClassName="atc-dots-btn"
        isDeleteBusy={props.isDeleteBusy}
        isDownloadBusy={props.isDownloadBusy}
        isFavorite={props.isFavorite}
        isFavoriteBusy={props.isFavoriteBusy}
        isShareBusy={props.isShareBusy}
        onDelete={props.onDelete}
        onDownload={props.onDownload}
        onEdit={props.onEdit}
        onFavoriteToggle={props.onFavoriteToggle}
        onShare={props.onShare}
      />
    </article>
  );
}

function ListTile(props: CommonTileProps) {
  const { t } = useI18n();
  const coverUrl = useAlbumCoverUrl(
    props.album,
    selectAlbumListThumbPreviewVariant,
  );
  const paletteIdx = getAlbumPaletteIndex(props.album.id);
  const hasPhotos = props.album.photoCount > 0;
  const dateRangeLabel = hasPhotos
    ? formatDateRange(
        props.album.mediaRangeStart,
        props.album.mediaRangeEnd,
        props.locale,
      )
    : t("app.library.albumDateRangeEmpty");
  const photoLabel = formatRelativeCount(
    props.album.photoCount,
    props.photoForms,
  );

  return (
    <article className="atl">
      <Link
        aria-label={t("app.library.openAlbumAria", {
          albumName: props.album.name,
        })}
        className="flex flex-1 items-center gap-3.5 min-w-0"
        to={buildAlbumDetailPath(props.album.id)}
      >
        <div className={`atl-thumb album-palette-${paletteIdx}`}>
          {coverUrl ? (
            <img
              alt={t("app.library.albumCoverAlt", {
                albumName: props.album.name,
              })}
              className="atl-thumb-image"
              src={coverUrl}
            />
          ) : null}
        </div>
        <span className="atl-name" title={props.album.name}>
          {props.album.name}
        </span>
        {props.isFavorite ? (
          <span
            aria-hidden
            className="shrink-0 text-[var(--color-accent-strong)]"
          >
            <Star size={13} fill="currentColor" strokeWidth={1.5} />
          </span>
        ) : null}
        {props.album.description ? (
          <>
            <span className="shrink-0 text-[var(--color-text-muted)]">·</span>
            <span className="atl-desc">{props.album.description}</span>
          </>
        ) : (
          <span className="flex-1" aria-hidden />
        )}
        <span className="atl-meta">
          <span className="atl-meta-strong">{props.album.photoCount}</span>
          {" · "}
          {dateRangeLabel}
          <span className="sr-only"> ({photoLabel})</span>
        </span>
      </Link>
      <ContextMenu
        album={props.album}
        buttonClassName="atl-dots-btn"
        isDeleteBusy={props.isDeleteBusy}
        isDownloadBusy={props.isDownloadBusy}
        isFavorite={props.isFavorite}
        isFavoriteBusy={props.isFavoriteBusy}
        isShareBusy={props.isShareBusy}
        onDelete={props.onDelete}
        onDownload={props.onDownload}
        onEdit={props.onEdit}
        onFavoriteToggle={props.onFavoriteToggle}
        onShare={props.onShare}
      />
    </article>
  );
}

export function AlbumTile(props: AlbumTileProps) {
  const { style, ...rest } = props;
  if (style === "compact") return <CompactTile {...rest} />;
  if (style === "list") return <ListTile {...rest} />;
  return <CardTile {...rest} />;
}

export const ALBUM_TILE_ICONS = {
  Edit: Edit3,
  Share: Share2,
  Download,
  Trash: Trash2,
  Star,
} as const;
