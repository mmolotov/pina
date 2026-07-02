import { Check, Clock, Folder, RotateCcw, Trash2 } from "lucide-react";
import { formatRelativeCount } from "~/lib/format";
import { useI18n } from "~/lib/i18n";
import type { TrashItemDto } from "~/types/api";

// Trashed items have no loadable thumbnail (their file endpoint 404s while
// trashed), so tiles render a deterministic solid fill / 2×2 mosaic — matching
// the prototype's placeholder look. The palette itself lives in app.css
// (keyed by data-tr-hue) so this component stays free of color literals.
const HUE_COUNT = 8;

function hueIndex(id: string, offset = 0) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0;
  }
  return (Math.abs(hash) + offset) % HUE_COUNT;
}

interface TrashTileProps {
  item: TrashItemDto;
  selecting: boolean;
  selected: boolean;
  leaving: boolean;
  onToggle: (id: string) => void;
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
}

export function TrashTile({
  item,
  selecting,
  selected,
  leaving,
  onToggle,
  onRestore,
  onPurge,
}: TrashTileProps) {
  const { t } = useI18n();
  const danger = item.daysLeft <= 3;
  const isAlbum = item.kind === "ALBUM";
  const countdown = formatRelativeCount(item.daysLeft, {
    one: t("app.trash.dayOne"),
    few: t("app.trash.dayFew"),
    many: t("app.trash.dayMany"),
    other: t("app.trash.dayOther"),
  });

  return (
    <div
      aria-label={
        selecting
          ? t(selected ? "app.trash.selectedItem" : "app.trash.selectItem", {
              name: item.name,
            })
          : item.name
      }
      aria-pressed={selecting ? selected : undefined}
      className={`tr-tile${selecting ? " selectable" : ""}${leaving ? " leaving" : ""}`}
      onClick={() => {
        if (selecting) onToggle(item.id);
      }}
      onKeyDown={(event) => {
        if (selecting && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onToggle(item.id);
        }
      }}
      role={selecting ? "button" : undefined}
      tabIndex={selecting ? 0 : undefined}
    >
      {isAlbum ? (
        <div aria-hidden="true" className="tr-mosaic">
          <span data-tr-hue={hueIndex(item.id, 0)} />
          <span data-tr-hue={hueIndex(item.id, 1)} />
          <span data-tr-hue={hueIndex(item.id, 2)} />
          <span data-tr-hue={hueIndex(item.id, 3)} />
        </div>
      ) : (
        <div className="tr-tile-fill" data-tr-hue={hueIndex(item.id)} />
      )}

      <div className="tr-tile-scrim" />

      <span
        className={`tr-countdown${danger ? " danger" : ""}`}
        title={t("app.trash.willDeleteIn", { days: countdown })}
      >
        <Clock size={11} /> {countdown}
      </span>

      {isAlbum && item.photoCount != null ? (
        <span className="tr-kind">
          <Folder size={11} />{" "}
          {formatRelativeCount(item.photoCount, {
            one: t("app.trash.photoOne"),
            few: t("app.trash.photoFew"),
            many: t("app.trash.photoMany"),
            other: t("app.trash.photoOther"),
          })}
        </span>
      ) : null}

      <span className="tr-tile-label">{item.name}</span>

      {selecting ? null : (
        <div className="tr-quick">
          <button
            aria-label={t("app.trash.restoreItem", { name: item.name })}
            className="tr-qbtn"
            onClick={(event) => {
              event.stopPropagation();
              onRestore(item.id);
            }}
            type="button"
          >
            <RotateCcw size={18} />
          </button>
          <button
            aria-label={t("app.trash.deleteForeverItem", { name: item.name })}
            className="tr-qbtn danger"
            onClick={(event) => {
              event.stopPropagation();
              onPurge(item.id);
            }}
            type="button"
          >
            <Trash2 size={18} />
          </button>
        </div>
      )}

      {selecting ? <div className="tr-sel-overlay" /> : null}
      {selecting ? (
        <span className="tr-check">
          {selected ? <Check size={13} /> : null}
        </span>
      ) : null}
    </div>
  );
}
