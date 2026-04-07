import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Badge,
  EmptyHint,
  FilterToolbar,
  InlineMessage,
  SurfaceCard,
} from "~/components/ui";

describe("shared ui primitives", () => {
  it("renders a surface card with the requested tone", () => {
    render(
      <SurfaceCard className="rounded-2xl p-4" tone="subtle">
        Surface content
      </SurfaceCard>,
    );

    const element = screen.getByText("Surface content");
    expect(element).toBeInTheDocument();
    expect(element).toHaveClass("surface-card-subtle");
  });

  it("renders badge tones through shared classes", () => {
    render(
      <>
        <Badge tone="accent">Accent badge</Badge>
        <Badge>Neutral badge</Badge>
      </>,
    );

    expect(screen.getByText("Accent badge")).toHaveClass("badge-accent");
    expect(screen.getByText("Neutral badge")).toHaveClass("badge-neutral");
  });

  it("renders inline feedback messages through shared alert classes", () => {
    render(
      <>
        <InlineMessage tone="danger">Danger state</InlineMessage>
        <InlineMessage tone="success">Success state</InlineMessage>
      </>,
    );

    expect(screen.getByText("Danger state")).toHaveClass("alert-danger");
    expect(screen.getByText("Success state")).toHaveClass("alert-success");
  });

  it("renders shared empty hints for subdued empty states", () => {
    render(<EmptyHint>No matching items.</EmptyHint>);

    const element = screen.getByText("No matching items.");
    expect(element).toBeInTheDocument();
    expect(element).toHaveClass("border-dashed");
  });

  it("renders filter toolbars with shared structure", () => {
    render(
      <FilterToolbar
        controls={<button type="button">Clear</button>}
        description="Shared filter helper."
        title="Filter"
      />,
    );

    expect(screen.getByText("Filter")).toBeInTheDocument();
    expect(screen.getByText("Shared filter helper.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });
});
