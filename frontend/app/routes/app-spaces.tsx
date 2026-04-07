import type { Route } from "./+types/app-spaces";
import { useEffect, useMemo, useState } from "react";
import {
  Form,
  Link,
  useActionData,
  useNavigation,
  useRevalidator,
} from "react-router";
import {
  Badge,
  EmptyState,
  FilterToolbar,
  InlineMessage,
  PageHeader,
  Panel,
  SurfaceCard,
} from "~/components/ui";
import { createSpace, listSpaces } from "~/lib/api";
import { formatDateTime } from "~/lib/format";
import { getActiveLocale, translateMessage, useI18n } from "~/lib/i18n";
import { toActionErrorMessage } from "~/lib/route-actions";
import type { SpaceVisibility } from "~/types/api";

export async function clientLoader() {
  return listSpaces();
}

type CreateSpaceActionResult =
  | { ok: true }
  | { ok: false; errorMessage: string };

export async function clientAction({
  request,
}: Route.ClientActionArgs): Promise<CreateSpaceActionResult> {
  const formData = await request.formData();

  try {
    await createSpace({
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      visibility: String(
        formData.get("visibility") ?? "PRIVATE",
      ) as SpaceVisibility,
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      errorMessage: toActionErrorMessage(
        error,
        translateMessage(getActiveLocale(), "app.spaces.createFailed"),
      ),
    };
  }
}

export default function AppSpacesRoute({ loaderData }: Route.ComponentProps) {
  const { locale, t } = useI18n();
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const [searchTerm, setSearchTerm] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<
    "ALL" | SpaceVisibility
  >("ALL");
  const [draft, setDraft] = useState({
    name: "",
    description: "",
    visibility: "PRIVATE" as SpaceVisibility,
  });

  useEffect(() => {
    if (actionData?.ok) {
      setDraft({
        name: "",
        description: "",
        visibility: "PRIVATE",
      });
      revalidator.revalidate();
    }
  }, [actionData, revalidator]);

  const spaces = loaderData;
  const isCreating = navigation.state !== "idle";
  const createError =
    actionData && !actionData.ok ? actionData.errorMessage : null;
  const filteredSpaces = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return spaces.filter((space) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        space.name.toLowerCase().includes(normalizedSearch) ||
        (space.description ?? "").toLowerCase().includes(normalizedSearch);
      const matchesVisibility =
        visibilityFilter === "ALL" || space.visibility === visibilityFilter;
      return matchesSearch && matchesVisibility;
    });
  }, [searchTerm, spaces, visibilityFilter]);
  const rootSpaceCount = useMemo(
    () => spaces.filter((space) => space.depth === 0).length,
    [spaces],
  );
  const publicSpaceCount = useMemo(
    () => spaces.filter((space) => space.visibility === "PUBLIC").length,
    [spaces],
  );
  const countFormatter = new Intl.NumberFormat(locale);

  return (
    <div className="space-y-8">
      <PageHeader
        actions={
          <>
            <Link className="button-secondary" to="/app/library?view=albums">
              {t("app.library.openAlbums")}
            </Link>
            <Link className="button-primary" to="/app/library">
              {t("app.favorites.openLibrary")}
            </Link>
          </>
        }
        description={t("app.spaces.description")}
        eyebrow={t("app.spaces.eyebrow")}
        title={t("app.spaces.title")}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Panel className="p-5">
          <p className="eyebrow">{t("app.spaces.accessibleSpaces")}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">
            {countFormatter.format(spaces.length)}
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            {t("app.spaces.accessibleSpacesDescription")}
          </p>
        </Panel>
        <Panel className="p-5">
          <p className="eyebrow">{t("app.spaces.rootSpaces")}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">
            {countFormatter.format(rootSpaceCount)}
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            {t("app.spaces.rootSpacesDescription")}
          </p>
        </Panel>
        <Panel className="p-5">
          <p className="eyebrow">{t("app.spaces.publicSpaces")}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">
            {countFormatter.format(publicSpaceCount)}
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            {t("app.spaces.publicSpacesDescription")}
          </p>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          {spaces.length === 0 ? (
            <EmptyState
              description={t("app.spaces.emptyDescription")}
              title={t("app.spaces.emptyTitle")}
            />
          ) : (
            <>
              <FilterToolbar
                className="mb-4 p-4"
                controls={
                  <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
                    <input
                      aria-label={t("app.spaces.filterLabel")}
                      className="field"
                      onChange={(event) => {
                        setSearchTerm(event.target.value);
                      }}
                      placeholder={t("app.spaces.filterPlaceholder")}
                      value={searchTerm}
                    />
                    <select
                      aria-label={t("app.spaces.visibilityFilterLabel")}
                      className="field"
                      onChange={(event) => {
                        setVisibilityFilter(
                          event.target.value as "ALL" | SpaceVisibility,
                        );
                      }}
                      value={visibilityFilter}
                    >
                      <option value="ALL">
                        {t("app.spaces.visibilityFilterAll")}
                      </option>
                      <option value="PRIVATE">
                        {t("app.spaces.visibilityFilterPrivate")}
                      </option>
                      <option value="PUBLIC">
                        {t("app.spaces.visibilityFilterPublic")}
                      </option>
                    </select>
                    <button
                      className="button-secondary"
                      onClick={() => {
                        setSearchTerm("");
                        setVisibilityFilter("ALL");
                      }}
                      type="button"
                    >
                      {t("common.clearFilters")}
                    </button>
                  </div>
                }
                description={t("app.spaces.toolbarDescription")}
                title={t("app.spaces.toolbarTitle")}
              />

              {filteredSpaces.length === 0 ? (
                <EmptyState
                  description={t("app.spaces.noMatchDescription")}
                  title={t("app.spaces.noMatchTitle")}
                />
              ) : (
                <section className="grid gap-4 lg:grid-cols-2">
                  {filteredSpaces.map((space) => (
                    <Panel className="p-6" key={space.id}>
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge
                          className="rounded-full px-3 py-1 text-xs font-semibold"
                          tone="accent"
                        >
                          {space.visibility === "PUBLIC"
                            ? t("common.public")
                            : t("common.private")}
                        </Badge>
                        <span className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-text-muted)]">
                          {t("app.spaces.depth", { count: space.depth })}
                        </span>
                      </div>
                      <h2 className="mt-4 text-2xl font-semibold tracking-tight">
                        {space.name}
                      </h2>
                      <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
                        {space.description || t("app.spaces.noDescription")}
                      </p>
                      <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                        {t("app.spaces.workspaceDescription")}
                      </p>
                      <dl className="mt-5 grid gap-2 text-sm text-[var(--color-text-muted)]">
                        <div className="flex justify-between gap-4">
                          <dt>{t("app.spaces.inheritance")}</dt>
                          <dd>
                            {space.inheritMembers
                              ? t("common.enabled")
                              : t("common.disabled")}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt>{t("app.spaces.created")}</dt>
                          <dd>{formatDateTime(space.createdAt)}</dd>
                        </div>
                      </dl>
                      <Link
                        className="button-secondary mt-5 w-full"
                        to={`/app/spaces/${space.id}`}
                      >
                        {t("app.spaces.openWorkspace")}
                      </Link>
                    </Panel>
                  ))}
                </section>
              )}
            </>
          )}
        </div>

        <div className="space-y-4">
          <SurfaceCard className="rounded-3xl p-5" tone="subtle">
            <p className="eyebrow">{t("app.spaces.albumsSpacesEyebrow")}</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">
              {t("app.spaces.albumsSpacesTitle")}
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
              {t("app.spaces.albumsSpacesDescription")}
            </p>
            <Link
              className="button-secondary mt-4 w-full"
              to="/app/library?view=albums"
            >
              {t("app.spaces.openPersonalAlbums")}
            </Link>
          </SurfaceCard>

          <Panel className="p-6">
            <p className="eyebrow">{t("app.spaces.createEyebrow")}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {t("app.spaces.createTitle")}
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
              {t("app.spaces.createDescription")}
            </p>

            <Form className="mt-5 space-y-4" method="post">
              <label className="block">
                <span className="mb-2 block text-sm font-medium">
                  {t("common.name")}
                </span>
                <input
                  aria-label={t("common.name")}
                  className="field"
                  name="name"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                  value={draft.name}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">
                  {t("common.description")}
                </span>
                <textarea
                  aria-label={t("common.description")}
                  className="field min-h-24 resize-y"
                  name="description"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  value={draft.description}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">
                  {t("common.visibility")}
                </span>
                <select
                  aria-label={t("common.visibility")}
                  className="field"
                  name="visibility"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      visibility: event.target.value as SpaceVisibility,
                    }))
                  }
                  value={draft.visibility}
                >
                  <option value="PRIVATE">{t("common.private")}</option>
                  <option value="PUBLIC">{t("common.public")}</option>
                </select>
              </label>

              {createError ? (
                <InlineMessage tone="danger">{createError}</InlineMessage>
              ) : null}

              <button
                className="button-primary w-full"
                disabled={isCreating}
                type="submit"
              >
                {isCreating
                  ? t("common.creating")
                  : t("app.spaces.createSubmit")}
              </button>
            </Form>
          </Panel>
        </div>
      </section>
    </div>
  );
}
