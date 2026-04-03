import { describe, expect, it } from "vitest";
import { ApiError } from "~/lib/api";
import {
  getRedirectTarget,
  resolveActionIntent,
  toActionErrorMessage,
} from "~/lib/route-actions";

describe("route-actions helpers", () => {
  it("normalizes action intents against an allow-list", () => {
    expect(
      resolveActionIntent("create", ["create", "delete"] as const, "create"),
    ).toBe("create");
    expect(
      resolveActionIntent("unknown", ["create", "delete"] as const, "create"),
    ).toBe("create");
  });

  it("prefers ApiError messages for action failures", () => {
    expect(
      toActionErrorMessage(
        new ApiError(409, "conflict", "Already exists"),
        "Fallback",
      ),
    ).toBe("Already exists");
    expect(toActionErrorMessage(new Error("Boom"), "Fallback")).toBe("Boom");
  });

  it("reads redirect targets from request urls", () => {
    const request = new Request(
      "http://localhost/login?redirect=%2Fapp%2Fspaces",
    );
    expect(getRedirectTarget(request, "/app")).toBe("/app/spaces");
    expect(
      getRedirectTarget(new Request("http://localhost/login"), "/app"),
    ).toBe("/app");
  });
});
