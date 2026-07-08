import { describe, expect, it } from "vitest";
import { toErrorMessage } from "~/lib/errors";

describe("toErrorMessage", () => {
  it("returns the message of a real Error", () => {
    expect(toErrorMessage(new Error("boom"), "fallback")).toBe("boom");
  });

  it("falls back for Errors without a message", () => {
    expect(toErrorMessage(new Error(""), "fallback")).toBe("fallback");
  });

  it("falls back for non-Error values", () => {
    expect(toErrorMessage("string error", "fallback")).toBe("fallback");
    expect(toErrorMessage({ message: "shape" }, "fallback")).toBe("fallback");
    expect(toErrorMessage(undefined, "fallback")).toBe("fallback");
  });
});
