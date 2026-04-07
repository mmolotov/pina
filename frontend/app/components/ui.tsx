import type { PropsWithChildren, ReactNode } from "react";

export function PageHeader(props: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {props.eyebrow ? <p className="eyebrow">{props.eyebrow}</p> : null}
        <h1
          className={`text-2xl font-semibold tracking-tight${props.eyebrow ? " mt-1" : ""}`}
        >
          {props.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-muted)]">
          {props.description}
        </p>
      </div>
      {props.actions ? (
        <div className="flex flex-wrap gap-2">{props.actions}</div>
      ) : null}
    </header>
  );
}

export function Panel({
  children,
  className = "",
}: PropsWithChildren<{ className?: string }>) {
  return <section className={`panel ${className}`.trim()}>{children}</section>;
}

export function SurfaceCard({
  children,
  className = "",
  tone = "default",
}: PropsWithChildren<{
  className?: string;
  tone?: "default" | "subtle";
}>) {
  const surfaceClass =
    tone === "subtle" ? "surface-card-subtle" : "surface-card";

  return (
    <div className={`${surfaceClass} ${className}`.trim()}>{children}</div>
  );
}

export function Badge({
  children,
  className = "",
  tone = "neutral",
}: PropsWithChildren<{
  className?: string;
  tone?: "accent" | "neutral";
}>) {
  const badgeClass = tone === "accent" ? "badge-accent" : "badge-neutral";

  return (
    <span className={`${badgeClass} ${className}`.trim()}>{children}</span>
  );
}

export function InlineMessage({
  children,
  className = "",
  tone,
}: PropsWithChildren<{
  className?: string;
  tone: "danger" | "success";
}>) {
  const messageClass = tone === "danger" ? "alert-danger" : "alert-success";

  return <p className={`${messageClass} ${className}`.trim()}>{children}</p>;
}

export function EmptyHint({
  children,
  className = "",
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={`rounded-lg border border-dashed border-[var(--color-border)] px-4 py-4 text-sm text-[var(--color-text-muted)] ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export function FilterToolbar(props: {
  title: string;
  description: string;
  controls: ReactNode;
  className?: string;
}) {
  return (
    <Panel className={`p-5 ${props.className ?? ""}`.trim()}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="eyebrow">{props.title}</p>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            {props.description}
          </p>
        </div>
        {props.controls}
      </div>
    </Panel>
  );
}

export function StatCard(props: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Panel className="p-4">
      <p className="eyebrow">{props.label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">
        {props.value}
      </p>
      <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
        {props.hint}
      </p>
    </Panel>
  );
}

export function EmptyState(props: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Panel className="p-6 text-center">
      <h2 className="text-xl font-semibold tracking-tight">{props.title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--color-text-muted)]">
        {props.description}
      </p>
      {props.action ? (
        <div className="mt-4 flex justify-center">{props.action}</div>
      ) : null}
    </Panel>
  );
}
