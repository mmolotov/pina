import type { PropsWithChildren, ReactNode } from "react";

export function PageHeader(props: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="eyebrow">{props.eyebrow}</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          {props.title}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--color-text-muted)]">
          {props.description}
        </p>
      </div>
      {props.actions ? (
        <div className="flex flex-wrap gap-3">{props.actions}</div>
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

export function StatCard(props: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Panel className="p-5">
      <p className="eyebrow">{props.label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">
        {props.value}
      </p>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
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
    <Panel className="p-8 text-center">
      <h2 className="text-2xl font-semibold tracking-tight">{props.title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--color-text-muted)]">
        {props.description}
      </p>
      {props.action ? (
        <div className="mt-6 flex justify-center">{props.action}</div>
      ) : null}
    </Panel>
  );
}
