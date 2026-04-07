import { Link } from "react-router";
import { EmptyState, PageHeader, Panel, SurfaceCard } from "~/components/ui";

const adminRouteCopy = {
  users: {
    eyebrow: "Admin users",
    title: "User management",
    description:
      "Browse, inspect, and update instance users from a dedicated admin surface instead of overloading profile or Space membership screens.",
    actionLabel: "Open settings",
    actionTo: "/app/settings",
  },
  spaces: {
    eyebrow: "Admin Spaces",
    title: "Global Space oversight",
    description:
      "Review Spaces across the whole instance, inspect ownership and storage, and apply global moderation actions separately from ordinary member views.",
    actionLabel: "Open user Spaces",
    actionTo: "/app/spaces",
  },
  invites: {
    eyebrow: "Admin invites",
    title: "Invite oversight",
    description:
      "Monitor and revoke invite links across the instance without entering each Space detail route one by one.",
    actionLabel: "Open Spaces",
    actionTo: "/app/spaces",
  },
  storage: {
    eyebrow: "Admin storage",
    title: "Storage operations",
    description:
      "Operational storage reporting will summarize instance usage and expose breakdowns by owner and Space for capacity planning.",
    actionLabel: "Open library",
    actionTo: "/app/library",
  },
  health: {
    eyebrow: "Admin health",
    title: "System health",
    description:
      "This route is reserved for backend, database, storage, and build-status visibility needed by instance operators.",
    actionLabel: "Open overview",
    actionTo: "/app/overview",
  },
  settings: {
    eyebrow: "Admin settings",
    title: "Instance settings",
    description:
      "Mutable instance-level controls such as registration mode belong here, separate from the current user's profile settings.",
    actionLabel: "Open profile settings",
    actionTo: "/app/settings",
  },
} as const;

export function AdminPlaceholder(props: { kind: keyof typeof adminRouteCopy }) {
  const copy = adminRouteCopy[props.kind];

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Link className="button-secondary" to={copy.actionTo}>
            {copy.actionLabel}
          </Link>
        }
        description={copy.description}
        eyebrow={copy.eyebrow}
        title={copy.title}
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <Panel className="p-6">
          <EmptyState
            description="The admin route tree and capability gate are now real. This screen is the stable entrypoint that the next admin UI subtask will fill with operational data and supported mutations."
            title="Section contract is ready"
          />
        </Panel>

        <SurfaceCard className="rounded-3xl p-5" tone="subtle">
          <p className="eyebrow">Next slice</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            Data UI lands next
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
            This placeholder keeps the admin navigation stable while the
            dedicated data-management task for this section is implemented.
          </p>
        </SurfaceCard>
      </section>
    </div>
  );
}
