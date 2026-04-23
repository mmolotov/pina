import { useEffect, useRef } from "react";
import { InlineMessage } from "~/components/ui";
import { formatDateTime } from "~/lib/format";
import { useI18n } from "~/lib/i18n";
import type { AlbumShareLinkDto } from "~/types/api";

function buildPublicAlbumShareUrl(token: string) {
  const path = `/api/v1/public/albums/by-token/${token}`;
  if (typeof window === "undefined") {
    return path;
  }
  return new URL(path, window.location.origin).toString();
}

export function AlbumShareDialog(props: {
  albumName: string;
  createdToken: string | null;
  errorMessage: string | null;
  infoMessage: string | null;
  isCreating: boolean;
  isLoading: boolean;
  links: AlbumShareLinkDto[];
  revokeBusyLinkId: string | null;
  onClose: () => void;
  onCopyLink: (url: string) => void;
  onCopyToken: (token: string) => void;
  onCreate: () => void;
  onRevoke: (linkId: string) => void;
}) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const initialFocusRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    initialFocusRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        props.onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [props]);

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
        className="w-full max-w-3xl rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-panel-strong)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.28)]"
        onKeyDown={trapFocus}
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{t("app.albumShare.eyebrow")}</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              {t("app.albumShare.title", { albumName: props.albumName })}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
              {t("app.albumShare.description")}
            </p>
          </div>
          <button
            className="button-secondary"
            onClick={props.onClose}
            ref={initialFocusRef}
            type="button"
          >
            {t("common.close")}
          </button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <p className="eyebrow">{t("app.albumShare.createEyebrow")}</p>
            <h3 className="mt-2 text-base font-semibold tracking-tight">
              {t("app.albumShare.createTitle")}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
              {t("app.albumShare.createDescription")}
            </p>
            <button
              className="button-primary mt-4"
              disabled={props.isCreating}
              onClick={props.onCreate}
              type="button"
            >
              {props.isCreating
                ? t("app.albumShare.creating")
                : t("app.albumShare.createButton")}
            </button>

            {props.createdToken ? (
              <div className="mt-4 space-y-4 rounded-[1rem] border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
                <div>
                  <p className="text-sm font-medium">
                    {t("app.albumShare.createdLinkLabel")}
                  </p>
                  <code className="mt-2 block overflow-x-auto rounded-lg bg-black/5 px-3 py-2 text-xs">
                    {buildPublicAlbumShareUrl(props.createdToken)}
                  </code>
                  <button
                    className="button-secondary mt-3 py-1.5 text-sm"
                    onClick={() =>
                      props.onCopyLink(
                        buildPublicAlbumShareUrl(props.createdToken!),
                      )
                    }
                    type="button"
                  >
                    {t("app.albumShare.copyLink")}
                  </button>
                </div>

                <div>
                  <p className="text-sm font-medium">
                    {t("app.albumShare.tokenLabel")}
                  </p>
                  <code className="mt-2 block overflow-x-auto rounded-lg bg-black/5 px-3 py-2 text-xs">
                    {props.createdToken}
                  </code>
                  <button
                    className="button-secondary mt-3 py-1.5 text-sm"
                    onClick={() => props.onCopyToken(props.createdToken!)}
                    type="button"
                  >
                    {t("app.albumShare.copyToken")}
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">{t("app.albumShare.existingEyebrow")}</p>
                <h3 className="mt-2 text-base font-semibold tracking-tight">
                  {t("app.albumShare.existingTitle")}
                </h3>
              </div>
              {props.isLoading ? (
                <span className="text-sm text-[var(--color-text-muted)]">
                  {t("common.loading")}
                </span>
              ) : null}
            </div>

            {props.links.length === 0 && !props.isLoading ? (
              <p className="mt-4 text-sm leading-6 text-[var(--color-text-muted)]">
                {t("app.albumShare.noLinks")}
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {props.links.map((link) => (
                  <div
                    className="rounded-[1rem] border border-[var(--color-border)] bg-[var(--color-panel)] p-4"
                    key={link.id}
                  >
                    <dl className="grid gap-2 text-sm text-[var(--color-text-muted)]">
                      <div className="flex justify-between gap-4">
                        <dt>{t("app.albumShare.createdAt")}</dt>
                        <dd>{formatDateTime(link.createdAt)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>{t("app.albumShare.expiresAt")}</dt>
                        <dd>
                          {link.expiresAt
                            ? formatDateTime(link.expiresAt)
                            : t("app.albumShare.noExpiry")}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>{t("app.albumShare.status")}</dt>
                        <dd>
                          {link.revokedAt
                            ? t("app.albumShare.revoked")
                            : t("app.albumShare.active")}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex justify-end">
                      <button
                        className="button-secondary py-1.5 text-sm"
                        disabled={
                          link.revokedAt != null ||
                          props.revokeBusyLinkId === link.id
                        }
                        onClick={() => props.onRevoke(link.id)}
                        type="button"
                      >
                        {props.revokeBusyLinkId === link.id
                          ? t("common.updating")
                          : t("app.albumShare.revoke")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {props.errorMessage ? (
          <InlineMessage className="mt-4" tone="danger">
            {props.errorMessage}
          </InlineMessage>
        ) : null}

        {props.infoMessage ? (
          <InlineMessage className="mt-4" tone="success">
            {props.infoMessage}
          </InlineMessage>
        ) : null}
      </div>
    </div>
  );
}
