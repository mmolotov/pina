import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";
import AppIndexRoute from "~/routes/app-index";

describe("AppIndexRoute", () => {
  it("redirects the authenticated app root to the library route", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app",
        Component: AppIndexRoute,
      },
      {
        path: "/app/library",
        Component: () => <div>Library landing</div>,
      },
    ]);

    render(<Stub initialEntries={["/app"]} />);

    expect(await screen.findByText("Library landing")).toBeInTheDocument();
  });
});
