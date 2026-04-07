import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "~/lib/i18n";
import { CollectionPlaceholder } from "~/routes/app-collection-placeholder";

describe("CollectionPlaceholder", () => {
  it("renders recent guidance with timeline-first actions", () => {
    const Stub = createRoutesStub([
      {
        path: "/app/recent",
        Component: () => <CollectionPlaceholder kind="recent" />,
      },
    ]);

    render(
      <I18nProvider>
        <Stub initialEntries={["/app/recent"]} />
      </I18nProvider>,
    );

    expect(screen.getByText("Recently touched media")).toBeInTheDocument();
    expect(screen.getByText("Planned activity view")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open timeline" })).toHaveLength(
      2,
    );
    expect(
      screen.getAllByRole("link", { name: "Open timeline" })[0],
    ).toHaveAttribute("href", "/app/library?view=timeline");
  });

  it("renders trash guidance as a limited retention route", () => {
    const Stub = createRoutesStub([
      {
        path: "/app/trash",
        Component: () => <CollectionPlaceholder kind="trash" />,
      },
    ]);

    render(
      <I18nProvider>
        <Stub initialEntries={["/app/trash"]} />
      </I18nProvider>,
    );

    expect(screen.getByText("Retention and recovery")).toBeInTheDocument();
    expect(
      screen.getByText("Waiting on retention semantics"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Deletion still bypasses a recovery bin/i),
    ).toBeInTheDocument();
  });
});
