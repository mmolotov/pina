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
} from "~/components/ui";
import { createSpace, listSpaces } from "~/lib/api";
import { formatDateTime } from "~/lib/format";
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
      errorMessage: toActionErrorMessage(error, "Failed to create Space."),
    };
  }
}

export default function AppSpacesRoute({ loaderData }: Route.ComponentProps) {
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

  return (
    <div className="space-y-8">
      <PageHeader
        description="This route now supports both browsing accessible Spaces and creating new root Spaces against the authenticated Phase 2 backend."
        eyebrow="Spaces"
        title="Shared workspaces"
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Panel className="p-5">
          <p className="eyebrow">Accessible Spaces</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">
            {spaces.length}
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            All visible Spaces and subspaces.
          </p>
        </Panel>
        <Panel className="p-5">
          <p className="eyebrow">Root Spaces</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">
            {rootSpaceCount}
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Top-level collaboration areas.
          </p>
        </Panel>
        <Panel className="p-5">
          <p className="eyebrow">Public Spaces</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">
            {publicSpaceCount}
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Currently visible without private-only filtering.
          </p>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-6">
          <p className="eyebrow">Create Space</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            New root Space
          </h2>

          <Form className="mt-5 space-y-4" method="post">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Name</span>
              <input
                aria-label="Name"
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
                Description
              </span>
              <textarea
                aria-label="Description"
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
              <span className="mb-2 block text-sm font-medium">Visibility</span>
              <select
                aria-label="Visibility"
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
                <option value="PRIVATE">Private</option>
                <option value="PUBLIC">Public</option>
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
              {isCreating ? "Creating..." : "Create Space"}
            </button>
          </Form>
        </Panel>

        <div>
          {spaces.length === 0 ? (
            <EmptyState
              description="Create a Space and it will appear here. Detail pages for members, subspaces, and invites are already routed."
              title="No accessible Spaces"
            />
          ) : (
            <>
              <FilterToolbar
                className="mb-4 p-4"
                controls={
                  <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
                    <input
                      aria-label="Filter spaces"
                      className="field"
                      onChange={(event) => {
                        setSearchTerm(event.target.value);
                      }}
                      placeholder="Filter by name or description"
                      value={searchTerm}
                    />
                    <select
                      aria-label="Filter visibility"
                      className="field"
                      onChange={(event) => {
                        setVisibilityFilter(
                          event.target.value as "ALL" | SpaceVisibility,
                        );
                      }}
                      value={visibilityFilter}
                    >
                      <option value="ALL">All visibility</option>
                      <option value="PRIVATE">Private only</option>
                      <option value="PUBLIC">Public only</option>
                    </select>
                    <button
                      className="button-secondary"
                      onClick={() => {
                        setSearchTerm("");
                        setVisibilityFilter("ALL");
                      }}
                      type="button"
                    >
                      Clear filters
                    </button>
                  </div>
                }
                description="Filter accessible Spaces by name, description, and visibility."
                title="Filters"
              />

              {filteredSpaces.length === 0 ? (
                <EmptyState
                  description="Try a different name fragment or reset the visibility filter."
                  title="No Spaces match the current filters"
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
                          {space.visibility.toLowerCase()}
                        </Badge>
                        <span className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-text-muted)]">
                          depth {space.depth}
                        </span>
                      </div>
                      <h2 className="mt-4 text-2xl font-semibold tracking-tight">
                        {space.name}
                      </h2>
                      <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
                        {space.description || "No description"}
                      </p>
                      <dl className="mt-5 grid gap-2 text-sm text-[var(--color-text-muted)]">
                        <div className="flex justify-between gap-4">
                          <dt>Inheritance</dt>
                          <dd>
                            {space.inheritMembers ? "Enabled" : "Disabled"}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt>Created</dt>
                          <dd>{formatDateTime(space.createdAt)}</dd>
                        </div>
                      </dl>
                      <Link
                        className="button-secondary mt-5 w-full"
                        to={`/app/spaces/${space.id}`}
                      >
                        Open Space
                      </Link>
                    </Panel>
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
