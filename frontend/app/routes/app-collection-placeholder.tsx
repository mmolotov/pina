import { Link } from "react-router";
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  SurfaceCard,
} from "~/components/ui";
import { useI18n, type MessageKey } from "~/lib/i18n";

const routeCopy = {
  recent: {
    eyebrow: "app.collection.recent.eyebrow",
    title: "app.collection.recent.title",
    description: "app.collection.recent.description",
    actionLabel: "app.collection.recent.action",
    actionTo: "/app/library?view=photos",
    secondaryActionLabel: "app.collection.recent.secondary",
    secondaryActionTo: "/app/library",
    status: "app.collection.recent.status",
    currentUse: "app.collection.recent.currentUse",
  },
  videos: {
    eyebrow: "app.collection.videos.eyebrow",
    title: "app.collection.videos.title",
    description: "app.collection.videos.description",
    actionLabel: "app.collection.videos.action",
    actionTo: "/app/library",
    secondaryActionLabel: "app.collection.videos.secondary",
    secondaryActionTo: "/app/library?view=photos",
    status: "app.collection.videos.status",
    currentUse: "app.collection.videos.currentUse",
  },
  trash: {
    eyebrow: "app.collection.trash.eyebrow",
    title: "app.collection.trash.title",
    description: "app.collection.trash.description",
    actionLabel: "app.collection.trash.action",
    actionTo: "/app/library",
    secondaryActionLabel: "app.collection.trash.secondary",
    secondaryActionTo: "/app/recent",
    status: "app.collection.trash.status",
    currentUse: "app.collection.trash.currentUse",
  },
} as const satisfies Record<
  string,
  {
    eyebrow: MessageKey;
    title: MessageKey;
    description: MessageKey;
    actionLabel: MessageKey;
    actionTo: string;
    secondaryActionLabel: MessageKey;
    secondaryActionTo: string;
    status: MessageKey;
    currentUse: MessageKey;
  }
>;

export function CollectionPlaceholder(props: { kind: keyof typeof routeCopy }) {
  const { t } = useI18n();
  const copy = routeCopy[props.kind];

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Link className="button-secondary" to={copy.secondaryActionTo}>
              {t(copy.secondaryActionLabel)}
            </Link>
            <Link className="button-primary" to={copy.actionTo}>
              {t(copy.actionLabel)}
            </Link>
          </>
        }
        description={t(copy.description)}
        eyebrow={t(copy.eyebrow)}
        title={t(copy.title)}
      />

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-6">
          <div className="flex items-center gap-3">
            <Badge
              className="rounded-full px-3 py-1 text-xs font-semibold"
              tone="accent"
            >
              {t("app.collection.limitedMode")}
            </Badge>
            <span className="text-sm font-medium text-[var(--color-text-muted)]">
              {t(copy.status)}
            </span>
          </div>

          <EmptyState
            action={
              <Link className="button-secondary" to={copy.actionTo}>
                {t(copy.actionLabel)}
              </Link>
            }
            description={t("app.collection.routeReadyDescription")}
            title={t("app.collection.routeReadyTitle")}
          />
        </Panel>

        <SurfaceCard className="rounded-3xl p-5" tone="subtle">
          <p className="eyebrow">{t("app.collection.useNowEyebrow")}</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            {t("app.collection.useNowTitle")}
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
            {t(copy.currentUse)}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link className="button-secondary w-full" to="/app/library">
              {t("app.collection.openLibrary")}
            </Link>
            <Link
              className="button-secondary w-full"
              to="/app/library?view=photos"
            >
              {t("app.collection.browseTimeline")}
            </Link>
          </div>
        </SurfaceCard>
      </section>
    </div>
  );
}
