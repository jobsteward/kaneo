import type { Context } from "hono";

export function activeWorkspaceIdOf(c: Context): string | undefined {
  const session = c.get("session") as {
    activeOrganizationId?: unknown;
  } | null;
  return typeof session?.activeOrganizationId === "string"
    ? session.activeOrganizationId
    : undefined;
}
