import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiError } from "~/lib/api";
import { ErrorBoundary } from "~/root";

describe("root ErrorBoundary", () => {
  it("renders a backend unavailable screen for API connectivity failures", () => {
    render(
      <ErrorBoundary
        error={
          new ApiError(
            503,
            "backend_unavailable",
            "Backend is unavailable. Check that the server is running and try again.",
          ) as never
        }
        params={{}}
      />,
    );

    expect(screen.getByText("Backend is unavailable")).toBeInTheDocument();
    expect(
      screen.getByText(/could not connect to the API/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open home" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
