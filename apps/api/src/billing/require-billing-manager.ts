import { and, eq, inArray } from "drizzle-orm";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { workspaceUserTable } from "../database/schema";
import { activeWorkspaceIdOf } from "../utils/active-workspace-id";
import { validateWorkspaceAccess } from "../utils/validate-workspace-access";

export async function requireBillingManager(c: Context, workspaceId: string) {
  const userId = c.get("userId");
  await validateWorkspaceAccess(
    userId,
    workspaceId,
    c.get("apiKey")?.id,
    activeWorkspaceIdOf(c),
  );

  const [member] = await db
    .select({ role: workspaceUserTable.role })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.userId, userId),
        inArray(workspaceUserTable.role, ["owner", "admin"]),
      ),
    );

  if (!member) {
    throw new HTTPException(403, {
      message: "Only workspace owners and admins can manage billing",
    });
  }
}
