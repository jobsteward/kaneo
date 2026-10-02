import type { Context } from "hono";
import { describe, expect, it } from "vite-plus/test";
import { activeWorkspaceIdOf } from "../../../apps/api/src/utils/active-workspace-id";

function contextWithSession(session: unknown): Context {
  return {
    get: (key: string) => (key === "session" ? session : undefined),
  } as unknown as Context;
}

describe("activeWorkspaceIdOf", () => {
  it("returns the active organization from the session", () => {
    expect(
      activeWorkspaceIdOf(
        contextWithSession({ activeOrganizationId: "workspace-1" }),
      ),
    ).toBe("workspace-1");
  });

  it("rejects non-string session values", () => {
    expect(
      activeWorkspaceIdOf(contextWithSession({ activeOrganizationId: 42 })),
    ).toBeUndefined();
  });
});
